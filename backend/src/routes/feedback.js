const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');
const { updateCommunityDB } = require('../lib/communityCheck');
const { updateImageRegistry } = require('../lib/imageAnalyzer');

// POST /api/feedback/:analyseId  — Submit score feedback
router.post('/:analyseId', requireAuth, async (req, res) => {
  const { analyseId } = req.params;
  const { verdict, comment } = req.body; // verdict: 'legit' | 'scam' | 'unsure'
  const userId = req.user.id;

  if (!['legit', 'scam', 'unsure'].includes(verdict)) {
    return res.status(400).json({ error: 'Verdict invalide.' });
  }

  // Verify ownership — also pull the fields needed to feed the registry
  // if this feedback turns out to confirm a scam.
  const { data: analyse } = await supabase
    .from('analyses')
    .select('id, user_id, risk_score, url, telephone, image_check_summary')
    .eq('id', analyseId)
    .eq('user_id', userId)
    .single();

  if (!analyse) return res.status(404).json({ error: 'Analyse introuvable.' });

  // Upsert feedback (one per user per analyse)
  const { data, error } = await supabase
    .from('feedback')
    .upsert({
      analyse_id: analyseId,
      user_id: userId,
      verdict,
      comment: comment?.slice(0, 500) || null,
      ai_score: analyse.risk_score,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'analyse_id,user_id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // ── THE REAL CONFIRMATION STEP ─────────────────────────────
  // This is the only place in the whole app where isScam: true should
  // ever be sent to the registry — a real person, looking back at a real
  // outcome, confirming it was a scam. Never derived from the AI's own
  // score (see analyse.js for why that would create a self-reinforcing
  // loop of unconfirmed guesses).
  if (verdict === 'scam') {
    updateCommunityDB({
      url: analyse.url,
      iban: null,
      phone: analyse.telephone,
      email: null,
      riskScore: analyse.risk_score,
      isScam: true,
    }).catch(console.error);

    const hashes = analyse.image_check_summary?.hashes || [];
    if (hashes.length > 0) {
      updateImageRegistry({
        hashes,
        isScam: true,
        analyseId: analyse.id,
      }).catch(console.error);
    }
  }

  return res.json({ success: true, data });
});

// GET /api/feedback/:analyseId  — Get feedback for an analysis
router.get('/:analyseId', requireAuth, async (req, res) => {
  const { analyseId } = req.params;
  const userId = req.user.id;

  const { data } = await supabase
    .from('feedback')
    .select('verdict, comment, submitted_at')
    .eq('analyse_id', analyseId)
    .eq('user_id', userId)
    .single();

  return res.json(data || null);
});

module.exports = router;