const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// POST /api/alerts/low-credits  — Called after each analysis to check & notify
router.post('/low-credits', requireAuth, async (req, res) => {
  const userId = req.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, email, low_credit_notified')
    .eq('id', userId)
    .single();

  if (!profile) return res.json({ sent: false });

  // Notify when credits drop to 2 (once per threshold crossing)
  if (profile.credits <= 2 && !profile.low_credit_notified) {
    // Update flag first to avoid duplicate sends
    await supabase.from('profiles')
      .update({ low_credit_notified: true })
      .eq('id', userId);

    // Send email via Supabase Edge Function or direct SMTP
    // Here we log it — integrate with Resend/Mailgun in production
    console.log(`📧 LOW CREDIT ALERT → ${profile.email} (${profile.credits} crédits restants)`);

    // Reset flag when user buys credits (handled in webhook.js)
    return res.json({ sent: true, credits: profile.credits });
  }

  // Reset flag if credits go back up (after purchase)
  if (profile.credits > 2 && profile.low_credit_notified) {
    await supabase.from('profiles')
      .update({ low_credit_notified: false })
      .eq('id', userId);
  }

  return res.json({ sent: false, credits: profile.credits });
});

// POST /api/alerts/watch  — Save an analysis to watch for changes
router.post('/watch', requireAuth, async (req, res) => {
  const { analyseId } = req.body;
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('watched_analyses')
    .upsert({ user_id: userId, analyse_id: analyseId, watched_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true, data });
});

// DELETE /api/alerts/watch/:analyseId  — Stop watching
router.delete('/watch/:analyseId', requireAuth, async (req, res) => {
  const { analyseId } = req.params;
  const userId = req.user.id;

  await supabase.from('watched_analyses')
    .delete()
    .eq('user_id', userId)
    .eq('analyse_id', analyseId);

  return res.json({ success: true });
});

// GET /api/alerts/watched  — List watched analyses
router.get('/watched', requireAuth, async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('watched_analyses')
    .select('*, analyses(*)')
    .eq('user_id', userId)
    .order('watched_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data || []);
});

module.exports = router;
