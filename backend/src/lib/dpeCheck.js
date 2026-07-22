/**
 * dpeCheck.js
 *
 * Cross-checks a listing's claimed address + surface against the official
 * French DPE (Diagnostic de Performance Énergétique) database, published
 * by ADEME as open data (data.ademe.fr, "DPE Logements existants" dataset,
 * Licence Ouverte / Open Licence v2.0 — Etalab).
 *
 * IMPORTANT ARCHITECTURE NOTE: the ADEME API blocks requests coming from
 * cloud/datacenter IP ranges (confirmed: Railway's outbound IP gets a 403
 * Forbidden from their nginx front, while the exact same request from a
 * regular browser succeeds). So the raw network fetch to data.ademe.fr
 * MUST happen client-side (in the visitor's browser), not from this
 * backend. This module only contains the MATCHING logic (pure functions,
 * no network calls) so the decision of "is this a match, is it reliable"
 * stays centralised and auditable on the server — only the HTTP fetch
 * itself is delegated to the browser. See routes/analyse.js and the new
 * POST /api/analyse/:id/dpe-verify endpoint for how the two halves connect.
 */

const SURFACE_MISMATCH_DANGER = 30;   // % difference considered a strong red flag
const SURFACE_MISMATCH_WARNING = 15;  // % difference considered worth noting
const MATCH_THRESHOLD = 0.5;          // minimum word-overlap score to trust a match

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

// ── Pure matching function: given the raw ADEME API "results" array
// (fetched client-side and forwarded to us), pick the best candidate.
// Returns { surfaceReelle, etiquette, anneeConstruction, typeBatiment,
// matchedAdresse, similarity } or null if nothing trustworthy found.
function pickBestDpeMatch(candidates, adressePrecise) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  if (!adressePrecise) return null;

  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = addressSimilarity(adressePrecise, c.adresse_ban);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (!best || bestScore < MATCH_THRESHOLD) return null;

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

// ── Build the ADEME API URL for the frontend to fetch directly ────────
// (kept here so the query-building logic isn't duplicated in the frontend)
function buildAdemeQueryUrl(adressePrecise, codePostal) {
  const base = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines';
  const qParam = encodeURIComponent(adressePrecise);
  let qs = '';
  if (codePostal) {
    qs = `&qs=${encodeURIComponent(`code_postal_ban:"${codePostal}"`)}`;
  }
  return `${base}?size=10&q=${qParam}${qs}`;
}

module.exports = { pickBestDpeMatch, buildDpeCriterion, addressSimilarity, buildAdemeQueryUrl };