const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { supabase } = require('../middleware/auth');
const { activatePlan, addCredits, PLANS } = require('../lib/subscriptionManager');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Facture le dépassement du forfait Pro (au-delà des 1000 analyses
 * incluses) avant que le compteur mensuel ne soit remis à zéro par
 * activatePlan(). On crée un Stripe "invoice item" en attente sur le
 * client : Stripe l'inclut automatiquement dans SA PROCHAINE facture
 * (pas celle qui vient d'être payée) — donc le dépassement d'un mois
 * apparaît sur la facture du mois suivant. C'est un décalage volontaire
 * et documenté (plus simple à fiabiliser qu'un abonnement à l'usage
 * Stripe complet), à expliquer à Dominique / aux clients si besoin.
 */
async function invoiceOverageIfAny({ userId, plan, stripeCustomerId }) {
  if (plan !== 'pro') return;
  const planInfo = PLANS.pro;
  if (!planInfo.fairUse || !planInfo.overagePricePerAnalysis) return;

  const { data: profile } = await supabase
    .from('profiles').select('analyses_this_year').eq('id', userId).single();
  const usage = profile?.analyses_this_year || 0;
  const overage = Math.max(0, usage - planInfo.fairUse);
  if (overage <= 0 || !stripeCustomerId) return;

  const amountCents = Math.round(overage * planInfo.overagePricePerAnalysis * 100);
  try {
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      amount: amountCents,
      currency: 'eur',
      description: `Dépassement forfait Pro — ${overage} analyse(s) au-delà des 1000 incluses (0,69 €/analyse)`,
    });
    console.log(`💳 Dépassement Pro facturé pour user ${userId} : ${overage} analyses, ${(amountCents / 100).toFixed(2)} €`);
  } catch (err) {
    console.error(`❌ Échec facturation dépassement Pro pour user ${userId} :`, err.message);
  }
}

/**
 * Retrouve ou crée le compte Supabase associé à un achat en invité
 * (pack à l'unité acheté sans être connecté). Envoie un email
 * d'invitation (lien de connexion, pas de mot de passe à choisir dans
 * l'urgence de l'achat) si le compte n'existait pas encore.
 *
 * Limite connue : listUsers() est paginé (50 comptes par page par
 * défaut côté Supabase) et ne filtre pas par email nativement. Pour un
 * volume d'utilisateurs plus important, remplacer par une fonction
 * Postgres dédiée (index sur email) plutôt qu'un scan de la liste.
 */
async function findOrCreateGuestAccount(email) {
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
  let userId;
  let isNewAccount = false;

  if (existing) {
    userId = existing.id;
  } else {
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/dashboard`,
    });
    if (inviteError) throw inviteError;
    userId = inviteData.user.id;
    isNewAccount = true;
  }

  // Crée la ligne de profil si elle n'existe pas déjà (selon qu'un
  // trigger côté base la crée automatiquement ou non).
  const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', userId).single();
  if (!existingProfile) {
    await supabase.from('profiles').insert({ id: userId, email, plan: 'pack', credits: 0 });
  } else if (isNewAccount) {
    // Le trigger public.handle_new_user() (côté Supabase, hors repo) a
    // déjà créé la ligne avec les 5 crédits de bienvenue standard —
    // prévus pour une inscription classique. Ce compte-ci n'existe que
    // comme effet de bord d'un achat en invité : on neutralise ce
    // cadeau pour que le client reçoive exactement les crédits payés
    // (ajoutés juste après par addCredits), ni plus ni moins.
    await supabase.from('profiles').update({ plan: 'pack', credits: 0 }).eq('id', userId);
  }

  return userId;
}

router.post('/', async (req, res) => {
  console.log('🔔 WEBHOOK REÇU', new Date().toISOString());

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('🔔 Signature vérifiée, type événement:', event.type);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      // ── One-time payment completed ───────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { userId, productId, credits, plan, isSubscription, guestCheckout } = session.metadata;
        console.log('🔔 checkout.session.completed — metadata:', JSON.stringify(session.metadata));

        let effectiveUserId = userId;

        // ── Achat en invité (pack à l'unité, sans compte préalable) ──
        if (!effectiveUserId && guestCheckout === 'true') {
          const email = session.customer_details?.email || session.customer_email;
          console.log('🔔 Branche invité, email:', email);
          if (!email) {
            console.error('❌ Achat invité sans email récupérable, session', session.id);
            break;
          }
          try {
            effectiveUserId = await findOrCreateGuestAccount(email);
            console.log(`👤 Compte invité résolu pour ${email} → ${effectiveUserId}`);
          } catch (err) {
            console.error('❌ Échec création compte invité pour', email, ':', err.message, err.stack);
            break;
          }
        }

        console.log('🔔 effectiveUserId après résolution:', effectiveUserId);
        if (!effectiveUserId) {
          console.error('❌ Pas d\'effectiveUserId, arrêt du traitement');
          break;
        }

        if (isSubscription === 'true' && plan) {
          // Activate annual subscription
          await activatePlan(effectiveUserId, plan);
          console.log(`✅ Plan ${plan} activated for user ${effectiveUserId}`);
        } else {
          // Add credits for pack purchase
          const creditsToAdd = parseInt(credits, 10) || 0;
          console.log('🔔 creditsToAdd:', creditsToAdd);
          if (creditsToAdd > 0) {
            await addCredits(effectiveUserId, creditsToAdd);
            console.log(`✅ +${creditsToAdd} credits for user ${effectiveUserId}`);
          }
        }

        // Log payment
        const { error: paymentLogError } = await supabase.from('payments').insert({
          user_id: effectiveUserId,
          stripe_session_id: session.id,
          amount: (session.amount_total || 0) / 100,
          credits_added: parseInt(credits, 10) || 0,
          plan_activated: plan || null,
          status: 'completed',
        });
        if (paymentLogError) {
          console.error('❌ Échec du log de paiement pour', effectiveUserId, ':', paymentLogError.message);
        } else {
          console.log('✅ Ligne payments insérée pour', effectiveUserId);
        }
        break;
      }

      // ── Subscription renewed (annual) ────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.billing_reason !== 'subscription_cycle') break;

        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = sub.metadata?.userId;
        const plan = sub.metadata?.plan;

        if (userId && plan) {
          // Facturer un éventuel dépassement Pro AVANT qu'activatePlan()
          // ne remette le compteur mensuel à zéro pour le nouveau cycle.
          await invoiceOverageIfAny({ userId, plan, stripeCustomerId: sub.customer });
          await activatePlan(userId, plan);
          console.log(`🔄 Plan ${plan} renewed for user ${userId}`);
        }
        break;
      }

      // ── Subscription cancelled ───────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          await supabase.from('profiles')
            .update({ plan: 'free', plan_expires_at: null, credits: 0 })
            .eq('id', userId);
          console.log(`❌ Subscription cancelled for user ${userId}`);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message, err.stack);
  }

  console.log('🔔 WEBHOOK terminé, réponse envoyée');
  res.json({ received: true });
});

module.exports = router;
