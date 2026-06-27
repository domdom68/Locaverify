/**
 * community.js — Routes for the community reporting system
 *
 * GET  /api/community/check        — Check URL/IBAN/phone/email against community DB
 * POST /api/community/report       — Manually report a listing as a scam
 * GET  /api/community/stats        — Global community statistics
 * GET  /api/community/recent       — Recent scam reports (public feed)
 */

const express = require('express');
const router = express.Router();
const { requireAuth, supabase } = require('../middleware/auth');
const { runCommunityChecks, normaliseUrl, normaliseIban, normalisePhone } = require('../lib/communityCheck');

// ── GET /api/community/check ──────────────────────────────────────
// Quick lookup — no credit consumed, no auth required for basic check
router.get('/check', async (req, res) => {
  const { url, iban, phone, email } = req.query;
  if (!url && !iban && !phone && !email) {
    return res.status(400).json({ error: 'Au moins un paramètre requis : url, iban, phone ou email.' });
  }
  try {
    const result = await runCommunityChecks({ url, iban, phone, email });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/community/report ────────────────────────────────────
router.post('/report', requireAuth, async (req, res) => {
  const {
    analyseId,
    url,
    iban,
    phone,
    email,
    scamType,      // 'fake_listing' | 'stolen_photos' | 'fake_owner' | 'advance_payment' | 'other'
    description,   // free text, max 1000 chars
    evidenceText,  // message received, etc.
  } = req.body;

  const userId = req.user.id;

  if (!url && !iban && !phone && !email) {
    return res.status(400).json({ error: 'Au moins un champ identifiant requis.' });
  }

  const VALID_TYPES = ['fake_listing','stolen_photos','fake_owner','advance_payment','other'];
  if (scamType && !VALID_TYPES.includes(scamType)) {
    return res.status(400).json({ error: 'Type d\'arnaque invalide.' });
  }

  try {
    // Save the report
    const { data: report, error } = await supabase
      .from('community_reports')
      .insert({
        reported_by: userId,
        analyse_id: analyseId || null,
        url_normalised: url ? normaliseUrl(url) : null,
        url_raw: url || null,
        iban_normalised: iban ? normaliseIban(iban) : null,
        phone_normalised: phone ? normalisePhone(phone) : null,
        email_normalised: email ? email.toLowerCase().trim() : null,
        scam_type: scamType || 'other',
        description: description?.slice(0, 1000) || null,
        evidence_text: evidenceText?.slice(0, 2000) || null,
        status: 'pending',   // pending | verified | rejected
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Trigger community DB update (async, non-blocking)
    updateCommunityAggregates({ url, iban, phone, email, isScam: true }).catch(console.error);

    return res.json({
      success: true,
      reportId: report.id,
      message: 'Signalement enregistré. Merci de contribuer à la protection de la communauté Seculoca.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/community/stats ──────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [reportsRes, listingsRes, ibansRes] = await Promise.all([
      supabase.from('community_reports').select('id', { count: 'exact', head: true }),
      supabase.from('reported_listings').select('id', { count: 'exact', head: true }),
      supabase.from('reported_ibans').select('id', { count: 'exact', head: true }),
    ]);

    return res.json({
      totalReports: reportsRes.count || 0,
      uniqueListings: listingsRes.count || 0,
      reportedIbans: ibansRes.count || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/community/recent ─────────────────────────────────────
router.get('/recent', async (req, res) => {
  try {
    const { data } = await supabase
      .from('community_reports')
      .select('scam_type, url_raw, created_at, description')
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(20);

    // Anonymise: mask part of URLs and remove personal data
    const safe = (data || []).map(r => ({
      scamType: r.scam_type,
      createdAt: r.created_at,
      description: r.description,
      urlDomain: r.url_raw ? (() => { try { return new URL(r.url_raw).hostname; } catch { return null; } })() : null,
    }));

    return res.json(safe);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Internal helper
async function updateCommunityAggregates({ url, iban, phone, email, isScam }) {
  const tasks = [];

  if (url) {
    const norm = normaliseUrl(url);
    if (norm) tasks.push(supabase.rpc('upsert_reported_listing', { p_url: norm, p_risk_score: 85, p_is_scam: isScam }));
  }
  if (iban) {
    const norm = normaliseIban(iban);
    if (norm) tasks.push(supabase.rpc('upsert_reported_iban', { p_iban: norm, p_is_scam: isScam }));
  }
  if (phone) tasks.push(supabase.rpc('upsert_reported_contact', { p_contact: normalisePhone(phone), p_type: 'phone', p_is_scam: isScam }));
  if (email) tasks.push(supabase.rpc('upsert_reported_contact', { p_contact: email.toLowerCase().trim(), p_type: 'email', p_is_scam: isScam }));

  await Promise.allSettled(tasks);
}

module.exports = router;
