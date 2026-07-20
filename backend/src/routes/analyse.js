const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { requireAuth, supabase } = require('../middleware/auth');
const { getUserPlanState, deductOneAnalysis } = require('../lib/subscriptionManager');
const { analyseListingImages, buildImageCriterion, updateImageRegistry } = require('../lib/imageAnalyzer');
const { runCommunityChecks, updateCommunityDB, buildCommunityCriterion } = require('../lib/communityCheck');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    // ── Run 3 checks in parallel: AI + images + community ────
    const [aiResult, imageResult, communityResult] = await Promise.allSettled([

      // 1. GPT-4o text analysis
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `Tu es un expert en détection de fraudes immobilières en France. Analyse cette annonce et renvoie UNIQUEMENT un objet JSON valide.

ANNONCE :
- Localisation : ${localisation}
- Prix (par ${dureePrixLabel}) : ${prix || 'non renseigné'} €
- Propriétaire / contact : ${proprietaire || 'non renseigné'}
- Téléphone du contact : ${telephone || 'non renseigné'}
- URL : ${url || 'non renseignée'}
- Texte : """${description}"""

Format JSON attendu :
{
  "risk_score": <0-100>,
  "summary": "<2-3 phrases>",
  "recommendation": "<conseil pratique>",
  "criteria": [
    {"label": "Prix vs marché local", "status": "<ok|warning|danger|info>", "detail": "<explication>"},
    {"label": "Analyse du texte", "status": "<ok|warning|danger|info>", "detail": "<explication>"},
    {"label": "Urgence et pression", "status": "<ok|warning|danger|info>", "detail": "<explication>"},
    {"label": "Mode de paiement", "status": "<ok|warning|danger|info>", "detail": "<explication>"},
    {"label": "Présence du propriétaire", "status": "<ok|warning|danger|info>", "detail": "<explication>"},
    {"label": "Cohérence de l'annonce", "status": "<ok|warning|danger|info>", "detail": "<explication>"},
    {"label": "Qualité rédactionnelle", "status": "<ok|warning|danger|info>", "detail": "<explication>"},
    {"label": "Comportement de contact", "status": "<ok|warning|danger|info>", "detail": "<explication>"}
  ]
}

Pour le critère "Comportement de contact", évalue en particulier : le refus d'appel vocal (uniquement SMS/WhatsApp), une demande de basculer immédiatement vers une messagerie externe, ou un numéro à l'étranger incohérent avec une annonce locale. Si aucune information sur le comportement de contact n'est disponible dans le texte, indique un statut "info" avec le détail "Donnée non disponible avec les informations fournies".

Pour le critère "Prix vs marché local", compare le prix indiqué avec les loyers du marché en tenant compte de la période de facturation précisée (jour, semaine ou mois : ${dureePrixLabel}). Ne compare jamais directement un prix journalier ou hebdomadaire à un loyer mensuel classique ; ramène-le à un équivalent mensuel avant de juger s'il est cohérent avec le marché local.`,
        }],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),

      // 2. Image analysis (if URL provided or imageUrls passed directly)
      (async () => {
        if (!url && (!imageUrls || imageUrls.length === 0)) {
          return { checked: false, reason: 'URL non fournie', results: [], summary: { dangerCount: 0, warningCount: 0, totalChecked: 0 } };
        }
        if (url) {
          // Fetch the listing page to extract images
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const pageRes = await fetch(url, {
              signal: controller.signal,
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Seculoca/1.0)' },
            });
            clearTimeout(timeout);
            const html = await pageRes.text();
            // apiKey may be undefined — analyseListingImages still runs the
            // free registry check + metadata check even without Vision
            return analyseListingImages(html, url, process.env.GOOGLE_VISION_API_KEY);
          } catch {
            return { checked: false, reason: 'Page inaccessible pour l\'analyse des images', results: [], summary: { dangerCount: 0, warningCount: 0, totalChecked: 0 } };
          }
        }
        return { checked: false, reason: 'Aucune URL fournie pour extraire les images', results: [], summary: { dangerCount: 0, warningCount: 0, totalChecked: 0 } };
      })(),

      // 3. Community database check
      runCommunityChecks({ url, iban: null, phone: telephone || null, email: null }),
    ]);

    // ── Parse AI result ──────────────────────────────────────
    let analysis;
    if (aiResult.status === 'fulfilled') {
      analysis = JSON.parse(aiResult.value.choices[0].message.content);
    } else {
      throw new Error('Analyse IA échouée : ' + aiResult.reason?.message);
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
      ...analysis.criteria,
      imageCriterion,
      communityCriterion,
    ];

    // ── Adjust global risk score based on new signals ────────
    const imgData    = imageResult.status === 'fulfilled' ? imageResult.value : null;
    const comData    = communityResult.status === 'fulfilled' ? communityResult.value : null;

    let adjustedScore = analysis.risk_score;

    // Image penalty
    if (imgData?.summary?.dangerCount > 0)  adjustedScore = Math.min(100, adjustedScore + 25);
    else if (imgData?.summary?.warningCount > 0) adjustedScore = Math.min(100, adjustedScore + 10);

    // Community penalty — confirmed scams get maximum boost
    if (comData?.dangerCount > 0)  adjustedScore = Math.min(100, adjustedScore + 30);
    else if (comData?.warningCount > 0) adjustedScore = Math.min(100, adjustedScore + 15);

    adjustedScore = Math.round(adjustedScore);

    // ── Extract perceptual hashes computed during image analysis,
    // stored alongside the summary so a later confirmed verdict can
    // feed them into the proprietary image registry. ───────────────
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
        summary: analysis.summary,
        recommendation: analysis.recommendation,
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
    // IMPORTANT: isScam is always false here. The AI's own risk_score is
    // NOT treated as a confirmed fraud verdict — doing so would create a
    // self-reinforcing loop where the model's own mistakes get written
    // into the registry as "confirmed", then read back as extra evidence
    // on the next analysis of the same listing. Only a real human verdict
    // (via the /api/feedback route, verdict = 'scam') should ever set
    // isScam = true. This call here only increments report_count / tracks
    // that the listing was seen, which is legitimate telemetry.
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
      summary: analysis.summary,
      recommendation: analysis.recommendation,
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