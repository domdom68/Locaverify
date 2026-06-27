/**
 * communityCheck.js
 * Cross-references an analysis against the community database:
 *  - Previously reported URLs
 *  - Previously reported IBANs
 *  - Previously reported phone numbers / emails
 *  - Listings with high community risk scores
 *
 * The community database is built from:
 *  1. User feedback (verdict = 'scam') on past analyses
 *  2. Explicit reports via the /api/community/report endpoint
 *  3. Aggregated risk scores from multiple independent analyses of the same listing
 */

const { supabase } = require('../middleware/auth');

// ── Normalise a URL to its canonical form for comparison ─────────
function normaliseUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Remove tracking params, fragments, trailing slashes
    u.hash = '';
    ['utm_source','utm_medium','utm_campaign','ref','source','from'].forEach(p => u.searchParams.delete(p));
    return u.origin + u.pathname.replace(/\/$/, '');
  } catch { return null; }
}

// ── Normalise phone: strip spaces, dashes, dots → E.164-ish ──────
function normalisePhone(phone) {
  if (!phone) return null;
  return phone.replace(/[\s\-\.\(\)]/g, '').replace(/^0/, '+33');
}

// ── Normalise IBAN: uppercase, no spaces ─────────────────────────
function normaliseIban(iban) {
  if (!iban) return null;
  return iban.replace(/\s/g, '').toUpperCase();
}

// ── Check a URL against reported_listings ────────────────────────
async function checkUrl(url) {
  const norm = normaliseUrl(url);
  if (!norm) return null;

  const { data } = await supabase
    .from('reported_listings')
    .select('id, report_count, scam_confirmed_count, avg_risk_score, last_reported_at, summary')
    .eq('url_normalised', norm)
    .single();

  if (!data) return null;

  const scamRatio = data.report_count > 0
    ? data.scam_confirmed_count / data.report_count
    : 0;

  return {
    found: true,
    reportCount: data.report_count,
    scamConfirmedCount: data.scam_confirmed_count,
    avgRiskScore: data.avg_risk_score,
    lastReportedAt: data.last_reported_at,
    scamRatio,
    riskLevel: scamRatio >= 0.7 || data.scam_confirmed_count >= 3
      ? 'danger'
      : scamRatio >= 0.4 || data.report_count >= 5
        ? 'warning'
        : 'info',
    detail: `Cette URL a été analysée ${data.report_count} fois par la communauté Seculoca. ${data.scam_confirmed_count} utilisateur(s) ont confirmé une arnaque. Score moyen : ${Math.round(data.avg_risk_score)}/100.`,
  };
}

// ── Check an IBAN against reported_ibans ─────────────────────────
async function checkIban(iban) {
  const norm = normaliseIban(iban);
  if (!norm) return null;

  const { data } = await supabase
    .from('reported_ibans')
    .select('id, report_count, confirmed_scam_count, first_seen_at, last_seen_at')
    .eq('iban_normalised', norm)
    .single();

  if (!data) return null;

  return {
    found: true,
    reportCount: data.report_count,
    confirmedScamCount: data.confirmed_scam_count,
    firstSeenAt: data.first_seen_at,
    riskLevel: data.confirmed_scam_count >= 1 || data.report_count >= 3 ? 'danger' : 'warning',
    detail: `Cet IBAN a été signalé ${data.report_count} fois dans notre base communautaire${data.confirmed_scam_count > 0 ? ` dont ${data.confirmed_scam_count} arnaque(s) confirmée(s)` : ''}.`,
  };
}

// ── Check a phone number ─────────────────────────────────────────
async function checkPhone(phone) {
  const norm = normalisePhone(phone);
  if (!norm) return null;

  const { data } = await supabase
    .from('reported_contacts')
    .select('id, report_count, confirmed_scam_count, contact_type')
    .eq('contact_normalised', norm)
    .eq('contact_type', 'phone')
    .single();

  if (!data) return null;

  return {
    found: true,
    reportCount: data.report_count,
    confirmedScamCount: data.confirmed_scam_count,
    riskLevel: data.confirmed_scam_count >= 1 ? 'danger' : 'warning',
    detail: `Ce numéro de téléphone a été signalé ${data.report_count} fois par la communauté Seculoca.`,
  };
}

// ── Check an email address ───────────────────────────────────────
async function checkEmail(email) {
  if (!email) return null;
  const norm = email.toLowerCase().trim();

  const { data } = await supabase
    .from('reported_contacts')
    .select('id, report_count, confirmed_scam_count')
    .eq('contact_normalised', norm)
    .eq('contact_type', 'email')
    .single();

  if (!data) return null;

  return {
    found: true,
    reportCount: data.report_count,
    confirmedScamCount: data.confirmed_scam_count,
    riskLevel: data.confirmed_scam_count >= 1 ? 'danger' : 'warning',
    detail: `Cette adresse email a été signalée ${data.report_count} fois par la communauté Seculoca.`,
  };
}

// ── Run all community checks and return consolidated result ───────
async function runCommunityChecks({ url, iban, phone, email }) {
  const [urlResult, ibanResult, phoneResult, emailResult] = await Promise.allSettled([
    checkUrl(url),
    checkIban(iban),
    checkPhone(phone),
    checkEmail(email),
  ]);

  const results = {
    url:   urlResult.status   === 'fulfilled' ? urlResult.value   : null,
    iban:  ibanResult.status  === 'fulfilled' ? ibanResult.value  : null,
    phone: phoneResult.status === 'fulfilled' ? phoneResult.value : null,
    email: emailResult.status === 'fulfilled' ? emailResult.value : null,
  };

  const hits = Object.values(results).filter(r => r?.found);
  const dangerHits = hits.filter(r => r.riskLevel === 'danger');
  const warningHits = hits.filter(r => r.riskLevel === 'warning');

  return {
    results,
    hasHits: hits.length > 0,
    dangerCount: dangerHits.length,
    warningCount: warningHits.length,
    overallRisk: dangerHits.length > 0 ? 'danger'
      : warningHits.length > 0 ? 'warning'
      : hits.length > 0 ? 'info'
      : 'ok',
  };
}

// ── Update community DB after an analysis (upsert pattern) ────────
async function updateCommunityDB({ url, iban, phone, email, riskScore, isScam }) {
  const tasks = [];

  // Update reported_listings
  if (url) {
    const norm = normaliseUrl(url);
    if (norm) {
      tasks.push(
        supabase.rpc('upsert_reported_listing', {
          p_url: norm,
          p_risk_score: riskScore,
          p_is_scam: isScam,
        })
      );
    }
  }

  // Update reported_ibans
  if (iban) {
    const norm = normaliseIban(iban);
    if (norm) {
      tasks.push(
        supabase.rpc('upsert_reported_iban', {
          p_iban: norm,
          p_is_scam: isScam,
        })
      );
    }
  }

  // Update reported_contacts
  if (phone) {
    tasks.push(
      supabase.rpc('upsert_reported_contact', {
        p_contact: normalisePhone(phone),
        p_type: 'phone',
        p_is_scam: isScam,
      })
    );
  }
  if (email) {
    tasks.push(
      supabase.rpc('upsert_reported_contact', {
        p_contact: email.toLowerCase().trim(),
        p_type: 'email',
        p_is_scam: isScam,
      })
    );
  }

  await Promise.allSettled(tasks);
}

// ── Build criterion entry for the analysis report ─────────────────
function buildCommunityCriterion(communityResult) {
  const { hasHits, dangerCount, warningCount, results } = communityResult;

  if (!hasHits) {
    return {
      label: 'Réputation communautaire',
      status: 'ok',
      detail: 'Aucun signalement dans notre base communautaire pour cette annonce, cet IBAN ou ces contacts.',
    };
  }

  const worstHit = results.url?.riskLevel === 'danger' ? results.url
    : results.iban?.riskLevel === 'danger' ? results.iban
    : results.phone?.riskLevel === 'danger' ? results.phone
    : results.email?.riskLevel === 'danger' ? results.email
    : results.url || results.iban || results.phone || results.email;

  const level = dangerCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'info';

  return {
    label: 'Réputation communautaire',
    status: level,
    detail: worstHit?.detail || `${dangerCount + warningCount} élément(s) signalé(s) par la communauté Seculoca.`,
    communityHits: {
      url: results.url?.found ? { count: results.url.reportCount, level: results.url.riskLevel } : null,
      iban: results.iban?.found ? { count: results.iban.reportCount, level: results.iban.riskLevel } : null,
      phone: results.phone?.found ? { count: results.phone.reportCount, level: results.phone.riskLevel } : null,
      email: results.email?.found ? { count: results.email.reportCount, level: results.email.riskLevel } : null,
    },
  };
}

module.exports = {
  runCommunityChecks,
  updateCommunityDB,
  buildCommunityCriterion,
  normaliseUrl,
  normaliseIban,
  normalisePhone,
};
