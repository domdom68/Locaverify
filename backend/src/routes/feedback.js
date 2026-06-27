const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// POST /api/feedback/:analyseId  — Submit score feedback
router.post('/:analyseId', requireAuth, async (req, res) => {
  const { analyseId } = req.params;
  const { verdict, comment } = req.body; // verdict: 'legit' | 'scam' | 'unsure'
  const userId = req.user.id;

  if (!['legit', 'scam', 'unsure'].includes(verdict)) {
    return res.status(400).json({ error: 'Verdict invalide.' });
  }

  // Verify ownership
  const { data: analyse } = await supabase
    .from('analyses')
    .select('id, user_id, risk_score')
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
