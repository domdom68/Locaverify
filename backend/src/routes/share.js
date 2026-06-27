const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');

// POST /api/share/:analyseId  — Generate a public share token
router.post('/:analyseId', requireAuth, async (req, res) => {
  const { analyseId } = req.params;
  const userId = req.user.id;

  // Verify ownership
  const { data: analyse } = await supabase
    .from('analyses')
    .select('id, user_id')
    .eq('id', analyseId)
    .eq('user_id', userId)
    .single();

  if (!analyse) return res.status(404).json({ error: 'Analyse introuvable.' });

  // Generate or retrieve existing share token
  const token = Buffer.from(`${analyseId}:${Date.now()}`).toString('base64url').slice(0, 16);

  const { data, error } = await supabase
    .from('shared_reports')
    .upsert({
      analyse_id: analyseId,
      token,
      created_by: userId,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    }, { onConflict: 'analyse_id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.json({
    token: data.token,
    shareUrl: `${process.env.FRONTEND_URL}/rapport/public/${data.token}`,
    expiresAt: data.expires_at,
  });
});

// GET /api/share/public/:token  — Fetch a shared report (no auth required)
router.get('/public/:token', async (req, res) => {
  const { token } = req.params;

  const { data: shared } = await supabase
    .from('shared_reports')
    .select('*, analyses(*)')
    .eq('token', token)
    .single();

  if (!shared) return res.status(404).json({ error: 'Rapport introuvable ou expiré.' });
  if (new Date(shared.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Ce lien de partage a expiré.' });
  }

  // Return analyse without user data
  const { user_id, ...safeAnalyse } = shared.analyses;
  return res.json(safeAnalyse);
});

module.exports = router;
