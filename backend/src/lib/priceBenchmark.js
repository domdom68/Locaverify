/**
 * priceBenchmark.js
 *
 * Looks up a real, official rent-per-m² benchmark for a given free-text
 * localisation, using the ANIL "Carte des loyers" dataset (rent_benchmarks
 * table) — instead of letting GPT-4o guess the local market rate.
 *
 * Source: "Estimations ANIL, à partir des données du Groupe SeLoger et de
 * leboncoin" (data.gouv.fr, mandatory attribution per the dataset's terms).
 *
 * Reliability caveat (per ANIL's own guidance): treat the benchmark as
 * less reliable when R2_adj < 0.5 or nbobs_com < 30 — in that case the
 * value is likely extrapolated from a wider surrounding area rather than
 * measured directly for that commune.
 */

const { supabase } = require('../middleware/auth');

const ARRONDISSEMENT_CITIES = ['paris', 'lyon', 'marseille'];

const ROMAN_NUMERALS = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
};

function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalise(str) {
  return stripAccents(str || '').toLowerCase().trim();
}

// ── Try to detect "Paris Vème", "Lyon 3e", "Marseille 8ème arrondissement" etc. ──
function parseArrondissement(rawText) {
  const text = normalise(rawText);

  for (const city of ARRONDISSEMENT_CITIES) {
    if (!text.includes(city)) continue;

    // Try arabic numeral first: "paris 9", "paris 9e", "paris 9eme"
    const arabicMatch = text.match(new RegExp(`${city}\\D{0,10}(\\d{1,2})`));
    if (arabicMatch) {
      return { city, number: parseInt(arabicMatch[1], 10) };
    }

    // Try roman numeral: "paris v", "paris vème", "paris xviieme"
    const romanMatch = text.match(new RegExp(`${city}\\s+(x{0,2}(?:ix|iv|v?i{0,3}))\\s*(?:e|eme|ème)?\\b`));
    if (romanMatch && ROMAN_NUMERALS[romanMatch[1]]) {
      return { city, number: ROMAN_NUMERALS[romanMatch[1]] };
    }
  }

  return null;
}

function capitalise(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// ── Main lookup: returns { loyerM2, reliable, matchedLibgeo, note } or null ──
async function lookupRentBenchmark(localisation) {
  if (!localisation) return null;

  const arrondissement = parseArrondissement(localisation);

  let query = supabase
    .from('rent_benchmarks')
    .select('LIBGEO, loyer_m2, r2_adj_num, nbobs_com')
    .not('loyer_m2', 'is', null);

  if (arrondissement) {
    const targetLibgeo = `${capitalise(arrondissement.city)} ${arrondissement.number}e Arrondissement`;
    query = query.ilike('LIBGEO', targetLibgeo);
  } else {
    const cleanedInput = normalise(localisation)
      .replace(/\d+/g, '')
      .trim();
    if (!cleanedInput || cleanedInput.length < 2) return null;
    query = query.ilike('LIBGEO', `%${cleanedInput}%`).limit(5);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  // If multiple fuzzy matches, prefer the one with the most observations
  // (more statistically solid) rather than the first alphabetical hit.
  const best = data.reduce((a, b) => ((b.nbobs_com || 0) > (a.nbobs_com || 0) ? b : a));

  const reliable = (best.r2_adj_num || 0) >= 0.5 && (best.nbobs_com || 0) >= 30;

  return {
    loyerM2: best.loyer_m2,
    reliable,
    matchedLibgeo: best.LIBGEO,
    note: reliable
      ? null
      : 'Estimation ANIL peu robuste pour cette commune (peu d\'annonces observées ou faible qualité de prédiction) — à interpréter avec prudence.',
  };
}

module.exports = { lookupRentBenchmark, parseArrondissement, normalise };