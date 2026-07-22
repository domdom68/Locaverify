/**
 * dpeCheck.js
 *
 * Cross-checks a listing's claimed address + surface against the official
 * French DPE (Diagnostic de Performance Énergétique) database, published
 * by ADEME as open data (data.ademe.fr, "DPE Logements existants" dataset,
 * Licence Ouverte / Open Licence v2.0 — Etalab).
 *
 * This is only useful when the listing mentions a precise street address
 * (many rental listings only give a neighbourhood/city before a visit is
 * arranged, which is normal, not suspicious) — but when an address IS
 * given, comparing it to the real, government-verified surface of that
 * exact building is a signal a fraudster has essentially no way to fake,
 * since they'd need to know this obscure cross-check exists at all.
 *
 * API docs: https://data.ademe.fr/datasets/dpe03existant/api-doc
 * No API key required — public open data.
 */

const https = require('https');

const API_HOST = 'data.ademe.fr';
const API_PATH = '/data-fair/api/v1/datasets/dpe03existant/lines';

const SURFACE_MISMATCH_DANGER = 30;   // % difference considered a strong red flag
const SURFACE_MISMATCH_WARNING = 15;  // % difference considered worth noting

function normaliseWords(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// ── Simple word-overlap similarity between the address typed by the user
// and each candidate address_ban returned by the API. Not a full address
// geocoder, but good enough to pick the best match among a handful of
// candidates for the same postal code.
function addressSimilarity(inputAddress, candidateAddress) {
  const a = new Set(normaliseWords(inputAddress));
  const b = new Set(normaliseWords(candidateAddress));
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const word of a) if (b.has(word)) overlap++;
  return overlap / Math.max(a.size, b.size);
}

function httpsGetJson(hostname, path, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 3) return reject(new Error('Trop de redirections'));

    const req = https.get({
      hostname,
      path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    }, res => {
      // Follow redirects (data.ademe.fr redirects the friendly slug to the
      // real internal dataset id — a browser does this transparently,
      // but Node's https.get does not by default).
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume(); // discard body
        const redirectUrl = new URL(res.headers.location, `https://${hostname}${path}`);
        return resolve(httpsGetJson(redirectUrl.hostname, redirectUrl.pathname + redirectUrl.search, redirectCount + 1));
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.error('[dpeCheck] Réponse non-JSON reçue (statusCode ' + res.statusCode + '), début :', data.slice(0, 200));
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(6000, () => { req.destroy(); reject(new Error('DPE API timeout')); });
  });
}

// ── Main lookup: returns { surfaceReelle, etiquette, anneeConstruction,
// typeBatiment, matchedAdresse, similarity } or null if no usable match.
async function lookupDpe(adressePrecise, codePostal) {
  if (!adressePrecise || adressePrecise.length < 5) {
    console.log('[dpeCheck] Adresse absente ou trop courte, skip:', adressePrecise);
    return null;
  }

  const qParam = encodeURIComponent(adressePrecise);
  let qs = '';
  if (codePostal) {
    qs = `&qs=${encodeURIComponent(`code_postal_ban:"${codePostal}"`)}`;
  }
  const path = `${API_PATH}?size=10&q=${qParam}${qs}`;
  console.log('[dpeCheck] Requête ADEME:', path);

  let json;
  try {
    json = await httpsGetJson(API_HOST, path);
  } catch (err) {
    console.error('[dpeCheck] Erreur appel API ADEME:', err.message);
    return null;
  }

  const candidates = json?.results || [];
  console.log('[dpeCheck] Nombre de candidats reçus:', candidates.length);
  if (candidates.length === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = addressSimilarity(adressePrecise, c.adresse_ban);
    console.log('[dpeCheck] Candidat:', c.adresse_ban, '- score:', score.toFixed(2));
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  // Require a reasonably strong word overlap before trusting the match —
  // otherwise we'd risk comparing against a random nearby building.
  if (!best || bestScore < 0.5) {
    console.log('[dpeCheck] Meilleur score insuffisant (< 0.5):', bestScore);
    return null;
  }

  return {
    surfaceReelle: best.surface_habitable_logement || null,
    etiquette: best.etiquette_dpe || null,
    anneeConstruction: best.annee_construction || null,
    typeBatiment: best.type_batiment || null,
    matchedAdresse: best.adresse_ban,
    similarity: bestScore,
  };
}

// ── Build the criterion entry, comparing claimed vs official surface ──
function buildDpeCriterion(dpeMatch, surfaceAnnoncee) {
  if (!dpeMatch) {
    return {
      label: 'Cohérence adresse/surface (DPE)',
      status: 'info',
      detail: 'Adresse précise non mentionnée ou non trouvée dans la base officielle des diagnostics énergétiques (DPE) — vérification non applicable.',
    };
  }

  if (!surfaceAnnoncee || !dpeMatch.surfaceReelle) {
    return {
      label: 'Cohérence adresse/surface (DPE)',
      status: 'info',
      detail: `Adresse retrouvée dans la base officielle DPE (${dpeMatch.matchedAdresse}), mais surface non comparable (donnée manquante d'un côté).`,
    };
  }

  const ecartPct = Math.round(((surfaceAnnoncee - dpeMatch.surfaceReelle) / dpeMatch.surfaceReelle) * 100);
  const absEcart = Math.abs(ecartPct);

  if (absEcart >= SURFACE_MISMATCH_DANGER) {
    return {
      label: 'Cohérence adresse/surface (DPE)',
      status: 'danger',
      detail: `Surface annoncée (${surfaceAnnoncee} m²) très différente de la surface officielle du DPE pour ${dpeMatch.matchedAdresse} (${dpeMatch.surfaceReelle} m², écart ${ecartPct > 0 ? '+' : ''}${ecartPct}%) — incohérence forte.`,
    };
  }

  if (absEcart >= SURFACE_MISMATCH_WARNING) {
    return {
      label: 'Cohérence adresse/surface (DPE)',
      status: 'warning',
      detail: `Surface annoncée (${surfaceAnnoncee} m²) différente de la surface officielle du DPE (${dpeMatch.surfaceReelle} m², écart ${ecartPct > 0 ? '+' : ''}${ecartPct}%) — à vérifier.`,
    };
  }

  return {
    label: 'Cohérence adresse/surface (DPE)',
    status: 'ok',
    detail: `Surface annoncée cohérente avec le DPE officiel de ${dpeMatch.matchedAdresse} (${dpeMatch.surfaceReelle} m²).`,
  };
}

module.exports = { lookupDpe, buildDpeCriterion, addressSimilarity };