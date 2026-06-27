const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { requireAuth, supabase } = require('../middleware/auth');
const { decodeIBAN, detectRiskyMethod, compareNames } = require('../lib/ibanDecoder');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/payment-check
 * Vérifie la cohérence des coordonnées de paiement reçues
 * avec les informations de l'annonce d'origine.
 */
router.post('/', requireAuth, async (req, res) => {
  const {
    analyseId,        // ID de l'analyse d'origine (optionnel)
    iban,             // IBAN reçu du prétendu propriétaire
    beneficiaryName,  // Nom du bénéficiaire sur l'IBAN
    paymentMethod,    // Texte libre : "Western Union", "PayPal", "virement", etc.
    paymentEmail,     // Email PayPal / Lydia / autre
    paymentPhone,     // Téléphone de paiement
    proprietaire,     // Nom du propriétaire de l'annonce
    localisation,     // Ville de l'annonce
    contactEmail,     // Email de contact de l'annonce
    additionalContext,// Texte libre : message reçu, demande suspecte, etc.
  } = req.body;

  const userId = req.user.id;

  // ── 1. Vérifications locales (sans IA) ──────────────────────────
  const checks = [];

  // Décodage IBAN
  let ibanResult = null;
  if (iban) {
    ibanResult = decodeIBAN(iban);
    checks.push({
      label: 'Validité et origine de l\'IBAN',
      status: ibanResult.valid ? ibanResult.riskLevel : 'danger',
      detail: ibanResult.valid
        ? `IBAN valide — Pays : ${ibanResult.countryName} (${ibanResult.countryCode}). ${ibanResult.riskReason}`
        : `IBAN INVALIDE — ${ibanResult.error || ibanResult.riskReason}`,
      data: ibanResult,
    });
  }

  // Méthode de paiement risquée
  const methodCheck = detectRiskyMethod(paymentMethod || additionalContext || '');
  if (methodCheck.detected) {
    checks.push({
      label: 'Mode de paiement',
      status: 'danger',
      detail: methodCheck.riskReason,
    });
  } else if (paymentMethod) {
    const isStandard = /virement|sepa|paypal|lydia|sumeria|revolut|wise|n26/i.test(paymentMethod);
    checks.push({
      label: 'Mode de paiement',
      status: isStandard ? 'ok' : 'info',
      detail: isStandard
        ? `Mode de paiement standard (${paymentMethod}) — utilisé pour les transactions légitimes.`
        : `Mode de paiement "${paymentMethod}" — vérifiez qu'il est courant et réversible.`,
    });
  }

  // Comparaison des noms
  if (beneficiaryName && proprietaire) {
    const nameComp = compareNames(beneficiaryName, proprietaire);
    checks.push({
      label: 'Cohérence du nom bénéficiaire',
      status: nameComp.riskLevel,
      detail: nameComp.detail,
    });
  }

  // Comparaison emails
  if (paymentEmail && contactEmail && paymentEmail.trim() && contactEmail.trim()) {
    const emailMatch = paymentEmail.toLowerCase().trim() === contactEmail.toLowerCase().trim();
    const domainA = paymentEmail.split('@')[1]?.toLowerCase();
    const domainB = contactEmail.split('@')[1]?.toLowerCase();
    const domainMatch = domainA && domainB && domainA === domainB;
    checks.push({
      label: 'Cohérence de l\'email de paiement',
      status: emailMatch ? 'ok' : domainMatch ? 'info' : 'warning',
      detail: emailMatch
        ? `L'email de paiement correspond à l'email de contact de l'annonce.`
        : domainMatch
          ? `Même domaine email (@${domainA}) mais adresses différentes — vérifiable.`
          : `Email de paiement (${paymentEmail}) différent de l'email de contact (${contactEmail}) — prudence.`,
    });
  }

  // Cohérence pays IBAN vs localisation annonce
  if (ibanResult?.valid && localisation) {
    const isFrance = /france|paris|lyon|marseille|bordeaux|toulouse|nantes|strasbourg|montpellier|nice|\bfr\b/i.test(localisation);
    if (isFrance && ibanResult.countryCode !== 'FR' && !ibanResult.isEU) {
      checks.push({
        label: 'Cohérence pays bancaire / localisation',
        status: 'danger',
        detail: `L'annonce est en France mais l'IBAN provient de ${ibanResult.countryName} — incohérence géographique majeure.`,
      });
    } else if (isFrance && ibanResult.countryCode !== 'FR' && ibanResult.isEU) {
      checks.push({
        label: 'Cohérence pays bancaire / localisation',
        status: 'warning',
        detail: `L'annonce est en France, l'IBAN est en ${ibanResult.countryName} (UE) — acceptable si le propriétaire est expatrié.`,
      });
    }
  }

  // ── 2. Analyse IA complémentaire ────────────────────────────────
  let aiAnalysis = null;
  const hasEnoughContext = additionalContext || (paymentMethod && beneficiaryName);

  if (hasEnoughContext) {
    try {
      const prompt = `Tu es un expert en détection de fraudes locatives. Analyse ces coordonnées de paiement et le contexte fourni.

INFORMATIONS DE L'ANNONCE :
- Propriétaire annoncé : ${proprietaire || 'non renseigné'}
- Localisation : ${localisation || 'non renseignée'}
- Email de contact annonce : ${contactEmail || 'non renseigné'}

COORDONNÉES DE PAIEMENT REÇUES :
- IBAN : ${iban || 'non fourni'} ${ibanResult ? `(${ibanResult.countryName}, ${ibanResult.valid ? 'valide' : 'INVALIDE'})` : ''}
- Nom bénéficiaire : ${beneficiaryName || 'non fourni'}
- Mode de paiement : ${paymentMethod || 'non précisé'}
- Email de paiement : ${paymentEmail || 'non fourni'}
- Téléphone : ${paymentPhone || 'non fourni'}

CONTEXTE / MESSAGE REÇU :
${additionalContext || 'Aucun contexte supplémentaire'}

Réponds UNIQUEMENT avec un objet JSON valide :
{
  "overall_risk": <0-100>,
  "verdict": "<Coordonnées cohérentes|Coordonnées suspectes|Arnaque très probable>",
  "summary": "<2-3 phrases d'analyse globale>",
  "red_flags": ["<signal 1>", "<signal 2>"],
  "recommendation": "<conseil clair et actionnable pour l'utilisateur>"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      aiAnalysis = JSON.parse(response.choices[0].message.content);
    } catch (err) {
      console.error('AI payment check error:', err.message);
    }
  }

  // ── 3. Score global ─────────────────────────────────────────────
  const dangerCount  = checks.filter(c => c.status === 'danger').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const localScore   = Math.min(100, dangerCount * 35 + warningCount * 15);
  const finalScore   = aiAnalysis
    ? Math.round((localScore * 0.4) + (aiAnalysis.overall_risk * 0.6))
    : localScore;

  // ── 4. Sauvegarde ───────────────────────────────────────────────
  const { data: saved } = await supabase
    .from('payment_checks')
    .insert({
      user_id: userId,
      analyse_id: analyseId || null,
      iban_country: ibanResult?.countryCode || null,
      iban_valid: ibanResult?.valid || null,
      beneficiary_name: beneficiaryName || null,
      payment_method: paymentMethod || null,
      risk_score: finalScore,
      checks,
      ai_analysis: aiAnalysis,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  return res.json({
    id: saved?.id,
    risk_score: finalScore,
    verdict: aiAnalysis?.verdict || (finalScore >= 70 ? 'Arnaque très probable' : finalScore >= 35 ? 'Coordonnées suspectes' : 'Coordonnées cohérentes'),
    summary: aiAnalysis?.summary || `${checks.length} vérifications effectuées. ${dangerCount} signal(s) critique(s) détecté(s).`,
    checks,
    red_flags: aiAnalysis?.red_flags || [],
    recommendation: aiAnalysis?.recommendation || (dangerCount > 0 ? 'Ne transmettez aucun paiement. Cessez tout contact et signalez l\'annonce.' : 'Restez vigilant et ne payez qu\'après visite physique du bien et signature d\'un bail.'),
    ibanDetails: ibanResult,
  });
});

module.exports = router;
