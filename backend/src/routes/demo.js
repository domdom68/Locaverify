const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  // Rate limit: 1 demo per IP per 24h
  const usage = demoUsage.get(ip);
  if (usage) {
    if (now - usage.firstUsed < DAY_MS && usage.count >= 1) {
      return res.status(429).json({
        error: 'Vous avez déjà utilisé votre analyse gratuite.',
        cta: 'Créez un compte gratuit pour obtenir 5 analyses supplémentaires.',
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

    return res.json({
      ...analysis,
      isDemo: true,
      message: 'Analyse gratuite utilisée. Créez un compte pour accéder à votre historique et 5 analyses supplémentaires.',
    });
  } catch (err) {
    console.error('Demo analyse error:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'analyse. Réessayez.' });
  }
});

module.exports = router;
