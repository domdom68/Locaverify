const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { supabase } = require('../middleware/auth');
const { activatePlan, addCredits } = require('../lib/subscriptionManager');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {

      // ── One-time payment completed ───────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { userId, productId, credits, plan, isSubscription } = session.metadata;
        if (!userId) break;

        if (isSubscription === 'true' && plan) {
          // Activate annual subscription
          await activatePlan(userId, plan);
          console.log(`✅ Plan ${plan} activated for user ${userId}`);
        } else {
          // Add credits for pack purchase
          const creditsToAdd = parseInt(credits, 10) || 0;
          if (creditsToAdd > 0) {
            await addCredits(userId, creditsToAdd);
            console.log(`✅ +${creditsToAdd} credits for user ${userId}`);
          }
        }

        // Log payment
        await supabase.from('payments').insert({
          user_id: userId,
          stripe_session_id: session.id,
          amount: (session.amount_total || 0) / 100,
          credits_added: parseInt(credits, 10) || 0,
          plan_activated: plan || null,
          status: 'completed',
        });
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
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
});

module.exports = router;
