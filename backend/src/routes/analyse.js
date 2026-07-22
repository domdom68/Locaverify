const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');
const { getUserPlanState, deductOneAnalysis } = require('../lib/subscriptionManager');
const { analyseListingImages, buildImageCriterion, updateImageRegistry } = require('../lib/imageAnalyzer');
const { runCommunityChecks, updateCommunityDB, buildCommunityCriterion } = require('../lib/communityCheck');
const { extractListingSignals, computeDeterministicScore, buildRecommendation } = require('../lib/aiSignalExtractor');
const { lookupRentBenchmark } = require('../lib/priceBenchmark');
const { pickBestDpeMatch, buildDpeCriterion, buildAdemeQueryUrl } = require('../lib/dpeCheck');

const DPE_LABEL = 'Cohérence adresse/surface (DPE)';

// POST /api/analyse
router.post('/', requireAuth, async (req, res) => {
  const { url, description, prix, duree_prix, localisation, proprietaire, telephone, imageUrls } = req.body;
  const userId = req.user.id;

  const dureePrixMap = { jour: 'jour', semaine: 'semaine', mois: 'mois' };
  const dureePrixLabel = dureePrixMap[duree_prix] || 'mois';

  if (!description || !localisation) {
    return res.status(400).json({ error: 'Champs obligatoires manquants : description, localisation.' });
  }

  // ── Check plan & quota ───────────────────────────────────────
  const planState = await getUserPlanState(userId);
  if (!planState.canAnalyse) {
    return res.status(402).json({ error: planState.reason, plan: planState.plan });
  }

  try {
    // ── Run 4 checks in parallel: AI signal extraction + images + community + rent benchmark ────
    const [aiResult, imageResult, communityResult, benchmarkResult] = await Promise.allSettled([

      // 1. GPT-4o — STEP 1 ONLY: extract factual signals, no scoring here
      extractListingSignals({ description, prix, dureePrixLabel, localisation, proprietaire, telephone, url }),

      // 2. Image analysis (if URL provided)
      (async () => {
        if (!url && (!imageUrls || imageUrls.length === 0)) {
          return { checked: false, reason: 'URL non fournie', results: [], summary: { dangerCount: 0, warningCount: 0, totalChecked: 0 } };
        }
        if (url) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const pageRes = await fetch(url, {
              signal: controller.signal,
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Seculoca/1.0)' },
            });
            clearTimeout(timeout);
            const html = await pageRes.text();
            return analyseListingImages(html, url, process.env.GOOGLE_VISION_API_KEY);
          } catch {
            return { checked: false, reason: 'Page inaccessible pour l\'analyse des images', results: [], summary: { dangerCount: 0, warningCount: 0, totalChecked: 0 } };
          }
        }
        return { checked: false, reason: 'Aucune URL fournie pour extraire les images', results: [], summary: { dangerCount: 0, warningCount: 0, totalChecked: 0 } };
      })(),

      // 3. Community database check
      runCommunityChecks({ url, iban: null, phone: telephone || null, email: null }),

      // 4. Real ANIL rent-per-m² benchmark for this localisation
      lookupRentBenchmark(localisation),
    ]);

    // ── STEP 2: deterministic scoring from extracted signals ────
    if (aiResult.status !== 'fulfilled') {
      throw new Error('Extraction des signaux IA échouée : ' + aiResult.reason?.message);
    }
    const signals = aiResult.value;
    const benchmark = benchmarkResult.status === 'fulfilled' ? benchmarkResult.value : null;
    const { score: baseScore, criteria: aiCriteria, summary: aiSummary } = computeDeterministicScore(signals, benchmark);

    // ── DPE cross-check: the ADEME API blocks server/datacenter IPs, so
    // the actual network fetch has to happen client-side (browser). Here
    // we only prepare the criterion + tell the frontend whether it needs
    // to do a follow-up check (see buildAdemeQueryUrl + /:id/dpe-verify).
    const surfaceM2 = signals.prix?.surface_m2 || null;
    let dpeCriterion;
    let dpeCheckInfo = { needed: false };

    if (signals.adresse_precise) {
      dpeCriterion = {
        label: DPE_LABEL,
        status: 'info',
        detail: 'Adresse précise détectée — vérification auprès de la base officielle DPE en cours.',
      };
      dpeCheckInfo = {
        needed: true,
        queryUrl: buildAdemeQueryUrl(signals.adresse_precise, signals.code_postal),
      };
    } else {
      dpeCriterion = buildDpeCriterion(null, surfaceM2);
    }

    // ── Build additional criteria ────────────────────────────
    const imageCriterion = buildImageCriterion(
      imageResult.status === 'fulfilled' ? imageResult.value : { checked: false, reason: 'Erreur analyse images', results: [], summary: { dangerCount: 0, warningCount: 0, totalChecked: 0 } }
    );

    const communityCriterion = buildCommunityCriterion(
      communityResult.status === 'fulfilled' ? communityResult.value : { hasHits: false, dangerCount: 0, warningCount: 0, results: {} }
    );

    // ── Merge all criteria ───────────────────────────────────
    const allCriteria = [
      ...aiCriteria,
      imageCriterion,
      communityCriterion,
      dpeCriterion,
    ];

    // ── Adjust global risk score based on image/community signals ────
    // (DPE is NOT included yet — it's added later by /dpe-verify once the
    // browser has done the actual ADEME fetch and sent back the results.)
    const imgData = imageResult.status === 'fulfilled' ? imageResult.value : null;
    const comData = communityResult.status === 'fulfilled' ? communityResult.value : null;

    let adjustedScore = baseScore;

    if (imgData?.summary?.dangerCount > 0) adjustedScore = Math.min(100, adjustedScore + 25);
    else if (imgData?.summary?.warningCount > 0) adjustedScore = Math.min(100, adjustedScore + 10);

    if (comData?.dangerCount > 0) adjustedScore = Math.min(100, adjustedScore + 30);
    else if (comData?.warningCount > 0) adjustedScore = Math.min(100, adjustedScore + 15);

    adjustedScore = Math.round(Math.min(100, adjustedScore));

    const recommendation = buildRecommendation(adjustedScore);

    // ── Extract perceptual hashes for the proprietary image registry ──
    const imageHashes = (imgData?.results || [])
      .map(r => r.perceptualHash)
      .filter(Boolean);

    // ── Save analysis ────────────────────────────────────────
    const { data: saved, error: saveError } = await supabase
      .from('analyses')
      .insert({
        user_id: userId,
        url: url || null,
        description: description.slice(0, 2000),
        prix: prix ? parseFloat(prix) : null,
        duree_prix: dureePrixLabel,
        localisation,
        proprietaire: proprietaire || null,
        telephone: telephone || null,
        adresse_precise: signals.adresse_precise || null,
        surface_m2: surfaceM2,
        risk_score: adjustedScore,
        summary: aiSummary,
        recommendation,
        criteria: allCriteria,
        title: `${localisation} — ${prix ? prix + '€/' + dureePrixLabel : 'prix non renseigné'}`,
        image_check_summary: imgData ? { ...imgData.summary, hashes: imageHashes } : null,
        community_check_summary: comData ? { hasHits: comData.hasHits, dangerCount: comData.dangerCount } : null,
      })
      .select()
      .single();

    if (saveError) throw new Error('Erreur sauvegarde : ' + saveError.message);

    // ── Deduct credit ────────────────────────────────────────
    await deductOneAnalysis(userId, planState.plan);

    // ── Track occurrence in the community registry (async, non-blocking) ──
    updateCommunityDB({
      url,
      iban: null,
      phone: telephone || null,
      email: null,
      riskScore: adjustedScore,
      isScam: false,
    }).catch(console.error);

    if (imageHashes.length > 0) {
      updateImageRegistry({
        hashes: imageHashes,
        isScam: false,
        analyseId: saved.id,
      }).catch(console.error);
    }

    return res.json({
      id: saved.id,
      risk_score: adjustedScore,
      summary: aiSummary,
      recommendation,
      criteria: allCriteria,
      imageAnalysis: imgData?.summary || null,
      communityCheck: comData ? { hasHits: comData.hasHits, dangerCount: comData.dangerCount } : null,
      dpeCheck: dpeCheckInfo,
    });

  } catch (err) {
    console.error('Analyse error:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors de l\'analyse IA.' });
  }
});

// POST /api/analyse/:id/dpe-verify
// Called by the frontend AFTER it has fetched the raw ADEME results
// client-side (browser IP isn't blocked, unlike Railway's). We do the
// actual matching + scoring here, server-side, so the logic stays
// centralised and auditable — the browser is just relaying network data.
router.post('/:id/dpe-verify', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { candidates } = req.body; // raw "results" array from the ADEME API
  const userId = req.user.id;

  const { data: analyse, error: fetchError } = await supabase
    .from('analyses')
    .select('id, user_id, risk_score, criteria, adresse_precise, surface_m2')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !analyse) {
    return res.status(404).json({ error: 'Analyse introuvable.' });
  }

  if (!analyse.adresse_precise) {
    return res.status(400).json({ error: 'Cette analyse ne comporte pas d\'adresse précise à vérifier.' });
  }

  const dpeMatch = pickBestDpeMatch(candidates, analyse.adresse_precise);
  const newDpeCriterion = buildDpeCriterion(dpeMatch, analyse.surface_m2);

  let scoreDelta = 0;
  if (newDpeCriterion.status === 'danger') scoreDelta = 25;
  else if (newDpeCriterion.status === 'warning') scoreDelta = 10;

  const newScore = Math.min(100, (analyse.risk_score || 0) + scoreDelta);

  const updatedCriteria = (analyse.criteria || []).map(c =>
    c.label === DPE_LABEL ? newDpeCriterion : c
  );

  const { error: updateError } = await supabase
    .from('analyses')
    .update({ risk_score: newScore, criteria: updatedCriteria })
    .eq('id', id)