const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { requireAuth } = require('../middleware/auth');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Product catalog — one-time packs + annual subscriptions
const PRODUCTS = {
  essentiel: {
    id: 'essentiel',
    type: 'subscription',
    name: 'Abonnement Essentiel',
    priceId: process.env.STRIPE_PRICE_ESSENTIEL,
    credits: 0,
    isSubscription: true,
    plan: 'essentiel',
  },
  max: {
    id: 'max',
    type: 'subscription',
    name: 'Abonnement Max',
    priceId: process.env.STRIPE_PRICE_MAX,
    credits: 0,
    isSubscription: true,
    plan: 'max',
  },
  pro: {
    id: 'pro',
    type: 'subscription',
    name: 'Abonnement Pro',
    priceId: process.env.STRIPE_PRICE_PRO,
    credits: 0,
    isSubscription: true,
    plan: 'pro',
  },
};

// POST /api/payment/create-checkout
router.post('/create-checkout', requireAuth, async (req, res) => {
  const { productId } = req.body;
  const product = PRODUCTS[productId];

  if (!product) return res.status(400).json({ error: 'Produit invalide.' });
  if (!product.priceId) return res.status(500).json({ error: `Price ID manquant pour ${productId}.` });

  try {
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [{ price: product.priceId, quantity: 1 }],
      mode: product.type,
      success_url: `${process.env.FRONTEND_URL}/paiement/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/paiement`,
      metadata: {
        userId: req.user.id,
        productId,
        credits: String(product.credits),
        plan: product.plan || '',
        isSubscription: String(product.isSubscription),
      },
      customer_email: req.user.email,
      locale: 'fr',
    };

    // For subscriptions, allow future updates
    if (product.isSubscription) {
      sessionConfig.subscription_data = {
        metadata: { userId: req.user.id, plan: product.plan },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/payment/portal — Customer portal for subscription management
router.post('/portal', requireAuth, async (req, res) => {
  try {
    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
    if (!customers.data.length) {
      return res.status(404).json({ error: 'Aucun abonnement actif trouvé.' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });
    return res.json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
