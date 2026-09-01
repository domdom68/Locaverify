const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { computeTier } = require('../lib/reportBuilder');
const { verifyTurnstileToken } = require('../lib/turnstile');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Demo criteria don't use the exact same status vocabulary/weights as the
// real engine, but a rough tier from the score alone is enough here — the
// point is simply to never hand an anonymous, no-account visitor an exact
// number + full itemised breakdown to iterate against for free.
const TIER_LABELS = { faible: 'Risque faible', modere: 'Risque modéré', eleve: 'Risque élevé', critique: 'Risque critique' };

// In-memory store for demo rate limiting (resets on server restart)
// In production, use Redis for persistence
const demoUsage = new Map(); // ip -> { count, firstUsed }

function getDemoKey(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

// POST /api/demo/analyse  — 1 analyse gratuite sans compte, par IP
router.post('/analyse', async (req, res) => {
  const ip = getDemoKey(req);
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Point 2 du plan anti-abus : la démo est accessible sans compte, donc la
  // cible la plus facile pour un script automatisé qui changerait d'IP en
  // boucle. Le captcha Turnstile bloque l'essentiel des scripts avant même
  // d'atteindre la logique de limitation ci-dessous.
  const { turnstileToken } = req.body;
  const captchaCheck = await verifyTurnstileToken(turnstileToken, ip);
  if (!captchaCheck.success) {
    return res.status(400).json({ error: captchaCheck.error || 'Vérification anti-robot échouée.' });
  }

  // Rate limit: 1 demo per IP per 24h
  const usage = demoUsage.get(ip);
  if (usage) {
    if (now - usage.firstUsed < DAY_MS && usage.count >= 1) {
      return res.status(429).json({
        error: 'Vous avez déjà utilisé votre analyse gratuite.',
        cta: 'Créez un compte gratuit pour obtenir 3 analyses supplémentaires.',
      });
    }
    if (now - usage.firstUsed >= DAY_MS) {
      demoUsage.delete(ip); // Reset after 24h
    }
  }

  const { description, prix, localisation, url } = req.body;
  if (!description || !localisation) {
    return res.status(400).json({ error: 'Description et localisation sont obligatoires.' });
  }

  try {
    const prompt = `Tu es un expert en détection de fraudes immobilières. Analyse cette annonce et renvoie UNIQUEMENT un objet JSON valide.

ANNONCE :
- Localisation : ${localisation}
- Prix mensuel : ${prix || 'non renseigné'} €
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
    {"label": "Qualité rédactionnelle", "status": "<ok|warning|danger|info>", "detail": "<explication>"}
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(response.choices[0].message.content);

    // Record usage
    demoUsage.set(ip, { count: (usage?.count || 0) + 1, firstUsed: usage?.firstUsed || now });

    // Never hand an anonymous visitor the exact score + full per-criterion
    // breakdown — bucket into a wide tier and drop the itemised detail.
    // The full, detailed report is reserved for signed-in users (and,
    // there, shown as grouped families rather than raw criteria too).
    const niveau = computeTier(analysis.risk_score || 0, []);

    return res.json({
      niveau,
      niveauLabel: TIER_LABELS[niveau],
      summary: analysis.summary,
      recommendation: analysis.recommendation,
      isDemo: true,
      message: 'Analyse gratuite utilisée. Créez un compte pour accéder à votre historique, au rapport détaillé et à 3 analyses supplémentaires.',
    });
  } catch (err) {
    console.error('Demo analyse error:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'analyse. Réessayez.' });
  }
});

module.exports = router;
