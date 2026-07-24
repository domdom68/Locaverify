/**
 * domainSpoofCheck.js
 *
 * Détecte les domaines "typosquattés" imitant une grande plateforme
 * immobilière connue (ex: se-loger.com au lieu de seloger.com,
 * le-bon-coin.fr au lieu de leboncoin.fr). Purement déterministe —
 * aucun appel IA — basé sur une distance de Levenshtein entre le nom
 * de domaine observé et une liste de référence des plateformes
 * légitimes les plus courantes en France.
 */

// Domaines légitimes de référence (normalisés : sans www, sans tirets, en minuscules)
const KNOWN_PLATFORMS = [
  'seloger.com',
  'leboncoin.fr',
  'pap.fr',
  'logic-immo.com',
  'bienici.com',
  'orpi.com',
  'century21.fr',
  'superimmo.com',
  'immo-facile.com',
  'avendrealouer.fr',
  'lefigaro.immo',
  'airbnb.fr',
  'airbnb.com',
  'booking.com',
  'gens-de-confiance.com',
];

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Normalise un domaine : enlève protocole, www, tirets, sous-domaines superflus
function normaliseHost(rawUrl) {
  try {
    const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Compare le domaine observé à la liste des plateformes connues.
 * Renvoie un signal "suspect" si le domaine est visuellement très proche
 * (distance de Levenshtein faible, ou insertion/suppression d'un tiret)
 * d'un domaine légitime, SANS être ce domaine exact.
 */
function checkDomainSpoof(url) {
  if (!url) {
    return { checked: false, suspect: false, host: null, matchedDomain: null };
  }
  const host = normaliseHost(url);
  if (!host) {
    return { checked: false, suspect: false, host: null, matchedDomain: null };
  }

  // Domaine exact et légitime → rien à signaler
  if (KNOWN_PLATFORMS.includes(host)) {
    return { checked: true, suspect: false, host, matchedDomain: null };
  }

  const hostNoDash = host.replace(/-/g, '');

  for (const legit of KNOWN_PLATFORMS) {
    const legitNoDash = legit.replace(/-/g, '');

    // Cas 1 : même chaîne une fois les tirets retirés (ex: se-loger.com vs seloger.com)
    if (hostNoDash === legitNoDash && host !== legit) {
      return { checked: true, suspect: true, host, matchedDomain: legit, reason: 'tiret_ajoute' };
    }

    // Cas 2 : distance d'édition très faible (1-2 caractères) sur un nom assez long
    // pour éviter les faux positifs sur des domaines courts.
    if (legitNoDash.length >= 6) {
      const dist = levenshtein(hostNoDash, legitNoDash);
      if (dist > 0 && dist <= 2) {
        return { checked: true, suspect: true, host, matchedDomain: legit, reason: 'distance_faible', distance: dist };
      }
    }
  }

  return { checked: true, suspect: false, host, matchedDomain: null };
}

function buildDomainCriterion(result) {
  if (!result.checked) {
    return { label: 'Authenticité du nom de domaine', status: 'info', detail: 'Aucune URL fournie pour vérifier le domaine.' };
  }
  if (result.suspect) {
    return {
      label: 'Authenticité du nom de domaine',
      status: 'danger',
      detail: `Le domaine "${result.host}" ressemble fortement à "${result.matchedDomain}" — il pourrait s'agir d'un site frauduleux imitant une plateforme connue. Vérifiez attentivement l'orthographe de l'URL avant de continuer.`,
    };
  }
  return { label: 'Authenticité du nom de domaine', status: 'ok', detail: 'Le nom de domaine ne présente pas de ressemblance suspecte avec une plateforme connue.' };
}

module.exports = { checkDomainSpoof, buildDomainCriterion, KNOWN_PLATFORMS };
