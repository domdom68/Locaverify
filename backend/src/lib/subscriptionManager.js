/**
 * subscriptionManager.js
 * Handles subscription logic: plan detection, Fair Use enforcement,
 * credit checks for one-time packs, and plan feature gating.
 *
 * Plans:
 *  - free      : 5 analyses at signup, no renewal
 *  - pack      : prepaid credits (one-time purchase)
 *  - solo      : 29.99€/year, 500 analyses Fair Use
 *  - pro       : 99€/year, unlimited (2000 Fair Use) + API + CSV export
 */

const { supabase } = require('../middleware/auth');

const PLANS = {
  free:  { name: 'Découverte',      fairUse: 5,    annual: false, hasApi: false, hasCsv: false },
  pack:  { name: 'Pack Essentiel',  fairUse: null, annual: false, hasApi: false, hasCsv: false },
  solo:  { name: 'Solo',            fairUse: 500,  annual: true,  hasApi: false, hasCsv: false },
  pro:   { name: 'Pro',             fairUse: 2000, annual: true,  hasApi: true,  hasCsv: true  },
};

/**
 * Get the effective plan and usage state for a user.
 * Returns: { plan, canAnalyse, reason, creditsLeft, usageThisYear, fairUse }
 */
async function getUserPlanState(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, plan, plan_expires_at, analyses_this_year, plan_renewed_at')
    .eq('id', userId)
    .single();

  if (!profile) return { plan: 'free', canAnalyse: false, reason: 'Profil introuvable.' };

  const plan = profile.plan || 'free';
  const planInfo = PLANS[plan] || PLANS.free;
  const now = new Date();

  // ── Annual subscription ──────────────────────────────────────
  if (plan === 'solo' || plan === 'pro') {
    // Check expiry
    if (profile.plan_expires_at && new Date(profile.plan_expires_at) < now) {
      // Subscription expired — downgrade to free
      await supabase.from('profiles')
        .update({ plan: 'free', credits: 0 })
        .eq('id', userId);
      return { plan: 'free', canAnalyse: false, reason: 'Abonnement expiré. Renouvelez pour continuer.' };
    }

    // Fair Use check (reset yearly)
    const renewedAt = profile.plan_renewed_at ? new Date(profile.plan_renewed_at) : now;
    const usageThisYear = profile.analyses_this_year || 0;

    if (usageThisYear >= planInfo.fairUse) {
      return {
        plan, canAnalyse: false,
        reason: `Limite d'utilisation raisonnable atteinte (${planInfo.fairUse} analyses/an). Contactez le support si vous avez un besoin exceptionnel.`,
        usageThisYear, fairUse: planInfo.fairUse,
      };
    }

    return {
      plan, canAnalyse: true,
      usageThisYear, fairUse: planInfo.fairUse,
      remaining: planInfo.fairUse - usageThisYear,
      expiresAt: profile.plan_expires_at,
    };
  }

  // ── Credit-based (pack or free) ──────────────────────────────
  const credits = profile.credits || 0;
  if (credits <= 0) {
    return {
      plan, canAnalyse: false,
      reason: plan === 'free'
        ? 'Vos 5 analyses gratuites sont épuisées. Achetez un pack ou souscrivez un abonnement.'
        : 'Crédits épuisés. Achetez un nouveau pack ou passez à un abonnement illimité.',
      creditsLeft: 0,
    };
  }

  return { plan, canAnalyse: true, creditsLeft: credits };
}

/**
 * Deduct one analysis from the user's quota (credit or yearly counter).
 */
async function deductOneAnalysis(userId, plan) {
  if (plan === 'solo' || plan === 'pro') {
    // Increment yearly counter
    await supabase.rpc('increment_analyses_this_year', { p_user_id: userId });
  } else {
    // Deduct one credit
    const { data: profile } = await supabase
      .from('profiles').select('credits').eq('id', userId).single();
    if (profile) {
      await supabase.from('profiles')
        .update({ credits: Math.max(0, (profile.credits || 0) - 1) })
        .eq('id', userId);
    }
  }
}

/**
 * Activate or renew a subscription plan after Stripe payment.
 */
async function activatePlan(userId, planKey) {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  await supabase.from('profiles').update({
    plan: planKey,
    plan_expires_at: expiresAt.toISOString(),
    plan_renewed_at: now.toISOString(),
    analyses_this_year: 0,
    low_credit_notified: false,
  }).eq('id', userId);
}

/**
 * Add credits after a pack purchase.
 */
async function addCredits(userId, creditsToAdd) {
  const { data: profile } = await supabase
    .from('profiles').select('credits').eq('id', userId).single();
  const current = profile?.credits || 0;
  await supabase.from('profiles')
    .update({ credits: current + creditsToAdd, low_credit_notified: false })
    .eq('id', userId);
}

module.exports = { getUserPlanState, deductOneAnalysis, activatePlan, addCredits, PLANS };
