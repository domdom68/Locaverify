// Point 2 du plan anti-abus (voir discussion "arnaqueur qui teste en boucle") :
// ralentir/bloquer un utilisateur qui soumet la même annonce (ou une variante
// à peine modifiée) plusieurs fois de suite pour observer comment le rapport
// qualitatif réagit et affiner une annonce frauduleuse jusqu'à passer sous
// les radars. Ce module ne fait AUCUN appel réseau — c'est de la comparaison
// de texte pure, volontairement simple (pas d'embeddings/IA) pour rester
// rapide, gratuite et facile à auditer.

/**
 * Normalise un texte pour la comparaison : minuscules, accents retirés,
 * ponctuation supprimée, espaces multiples réduits.
 */
function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(str) {
  return new Set(normalizeText(str).split(' ').filter(w => w.length > 2));
}

/**
 * Similarité de Jaccard entre deux textes (intersection / union des mots).
 * 1 = textes quasi-identiques, 0 = aucun mot en commun.
 */
function textSimilarity(a, b) {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function normalizeLocalisation(loc) {
  return normalizeText(loc);
}

/**
 * Deux prix sont "proches" si l'écart est inférieur à 8% (permet à un
 * arnaqueur qui ajuste le prix de 10€ pour tester une bascule de palier
 * d'être quand même repéré) ou inférieur à 15€ en absolu (annonces à
 * bas loyer).
 */
function pricesAreClose(p1, p2) {
  if (p1 == null || p2 == null) return p1 === p2;
  const a = parseFloat(p1), b = parseFloat(p2);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  const diff = Math.abs(a - b);
  return diff <= 15 || diff / Math.max(a, b, 1) <= 0.08;
}

/**
 * Détermine si `candidate` (nouvelle soumission) est une quasi-copie de
 * `previous` (soumission passée). Combine : même localisation (normalisée),
 * prix proche, ET texte très similaire (>= 60% de mots communs). Les trois
 * conditions ensemble évitent les faux positifs (deux annonces différentes
 * dans le même quartier et au même loyer ne suffisent pas à déclencher).
 */
function isNearDuplicate(candidate, previous) {
  if (!candidate || !previous) return false;
  const sameLocalisation = normalizeLocalisation(candidate.localisation) === normalizeLocalisation(previous.localisation);
  if (!sameLocalisation) return false;
  if (!pricesAreClose(candidate.prix, previous.prix)) return false;
  const similarity = textSimilarity(candidate.description, previous.description);
  return similarity >= 0.6;
}

/**
 * Étant donné la soumission actuelle et une liste de soumissions récentes
 * (les plus récentes en premier), renvoie combien sont des quasi-doublons.
 */
function countNearDuplicates(candidate, recentSubmissions) {
  return recentSubmissions.filter(prev => isNearDuplicate(candidate, prev)).length;
}

module.exports = { normalizeText, textSimilarity, isNearDuplicate, countNearDuplicates, pricesAreClose, normalizeLocalisation };
