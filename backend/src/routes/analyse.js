const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');
const { getUserPlanState, deductOneAnalysis } = require('../lib/subscriptionManager');
const { analyseListingImages, buildImageCriterion, updateImageRegistry } = require('../lib/imageAnalyzer');
const { runCommunityChecks, updateCommunityDB, buildCommunityCriterion } = require('../lib/communityCheck');
const { extractListingSignals, computeDeterministicScore, buildRecommendation } = require('../lib/aiSignalExtractor');
const { lookupRentBenchmark } = require('../lib/priceBenchmark');

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
    ];

    // ── Adjust global risk score based on image/community signals ────
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
    // isScam is always false here — only a confirmed human verdict via
    // /api/feedback should ever mark something as a confirmed scam.
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
    });

  } catch (err) {
    console.error('Analyse error:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors de l\'analyse IA.' });
  }
});

module.exports = router;