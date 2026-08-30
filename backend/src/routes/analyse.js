const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');
const { getUserPlanState, deductOneAnalysis } = require('../lib/subscriptionManager');
const { analyseListingImages, buildImageCriterion, updateImageRegistry } = require('../lib/imageAnalyzer');
const { runCommunityChecks, updateCommunityDB, buildCommunityCriterion } = require('../lib/communityCheck');
const { extractListingSignals, computeDeterministicScore, buildRecommendation } = require('../lib/aiSignalExtractor');
const { lookupRentBenchmark } = require('../lib/priceBenchmark');
const { pickBestDpeMatch, buildDpeCriterion, buildAdemeQueryUrl } = require('../lib/dpeCheck');
const { checkDomainSpoof, buildDomainCriterion } = require('../lib/domainSpoofCheck');
const { buildClientReport } = require('../lib/reportBuilder');
const { isNearDuplicate } = require('../lib/abuseDetection');

const DPE_LABEL = 'Cohérence adresse/surface (DPE)';

// Point 2 du plan anti-abus : freiner un compte qui reteste la même annonce
// (ou une variante à peine modifiée — prix ajusté de quelques euros, une
// phrase reformulée) plusieurs fois de suite. C'est le cœur de l'attaque
// "oracle" qu'un arnaqueur utiliserait pour ajuster une fausse annonce
// jusqu'à passer sous les radars du rapport qualitatif.
const NEARDUP_WINDOW_MS = 3 * 60 * 60 * 1000;   // fenêtre d'historique comparée : 3h
const NEARDUP_THRESHOLD = 2;                     // à partir de la 3e soumission quasi-identique...
const NEARDUP_COOLDOWN_MS = 30 * 60 * 1000;      // ...on impose 30 min d'attente avant la suivante

// POST /api/analyse
router.post('/', requireAuth, async (req, res) => {
  const { url, description, prix, surface, duree_prix, localisation, proprietaire, telephone, imageUrls } = req.body;
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

  // ── Point 2 du plan anti-abus : détection des tests en boucle ────
  // Avant de lancer le pipeline (coûteux) et de décompter un crédit, on
  // vérifie si cette annonce ressemble fortement à une ou plusieurs
  // soumissions récentes de ce même compte.
  try {
    const { data: recent } = await supabase
      .from('analyses')
      .select('description, prix, localisation, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - NEARDUP_WINDOW_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    const candidate = { description, prix, localisation };
    const duplicates = (recent || []).filter(prev => isNearDuplicate(candidate, prev));

    if (duplicates.length >= NEARDUP_THRESHOLD) {
      const elapsed = Date.now() - new Date(duplicates[0].created_at).getTime();
      if (elapsed < NEARDUP_COOLDOWN_MS) {
        const waitMin = Math.max(1, Math.ceil((NEARDUP_COOLDOWN_MS - elapsed) / 60000));
        return res.status(429).json({
          error: `Cette annonce (ou une version très proche) a déjà été analysée plusieurs fois récemment. Merci de patienter encore ${waitMin} minute${waitMin > 1 ? 's' : ''}, ou consultez le rapport déjà obtenu depuis votre tableau de bord.`,
        });
      }
    }
  } catch (dupCheckErr) {
    // Une panne de cette vérification ne doit jamais empêcher une analyse
    // légitime — on log et on continue normalement.
    console.error('Vérification anti-doublon échouée (analyse autorisée quand même) :', dupCheckErr.message);
  }

  try {
    // ── Run 4 checks in parallel: AI signal extraction + images + community + rent benchmark ────
    const [aiResult, imageResult, communityResult, benchmarkResult] = await Promise.allSettled([

      // 1. GPT-4o — STEP 1 ONLY: extract factual signals, no scoring here
      extractListingSignals({ description, prix, surface, dureePrixLabel, localisation, proprietaire, telephone, url }),

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
    // Priorité à la surface saisie manuellement (plus fiable), sinon celle extraite du texte par l'IA
const surfaceM2 = (surface && parseFloat(surface) > 0) ? parseFloat(surface) : (signals.prix?.surface_m2 || null);
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

    // ── Domain spoofing check (typosquatting de plateformes connues) ──
    const domainSpoofResult = checkDomainSpoof(url);
    const domainCriterion = buildDomainCriterion(domainSpoofResult);

    // ── Merge all criteria ───────────────────────────────────
    const allCriteria = [
      ...aiCriteria,
      imageCriterion,
      communityCriterion,
      domainCriterion,
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

    if (domainSpoofResult.suspect) adjustedScore = Math.min(100, adjustedScore + 35);

    adjustedScore = Math.round(Math.min(100, adjustedScore));

    const recommendation = buildRecommendation(adjustedScore, allCriteria);

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

    // ── Client-facing report: qualitative tier + 6 grouped families ──
    // (see reportBuilder.js — this is what the UI/PDF should render from
    // now on ; risk_score/criteria below stay for internal tooling and
    // for the DPE-verify merge, and are on the deprecation list once the
    // frontend has fully switched over — see point 2 of the anti-abuse plan).
    const report = buildClientReport({ score: adjustedScore, criteria: allCriteria });

    return res.json({
      id: saved.id,
      report,
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
    .eq('user_id', userId);

  if (updateError) {
    return res.status(500).json({ error: 'Erreur mise à jour : ' + updateError.message });
  }

  const report = buildClientReport({ score: newScore, criteria: updatedCriteria });

  return res.json({
    report,
    risk_score: newScore,
    criteria: updatedCriteria,
    dpeCriterion: newDpeCriterion,
  });
});

module.exports = router;