require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const analyseRouter  = require('./routes/analyse');
const paymentRouter  = require('./routes/payment');
const webhookRouter  = require('./routes/webhook');
const demoRouter     = require('./routes/demo');
const scrapeRouter   = require('./routes/scrape');
const alertsRouter   = require('./routes/alerts');
const shareRouter    = require('./routes/share');
const feedbackRouter    = require('./routes/feedback');
const paymentCheckRouter = require('./routes/paymentCheck');
const communityRouter    = require('./routes/community');
const userRouter         = require('./routes/user');
const contactRouter    = require('./routes/contact');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Webhook needs raw body BEFORE json parser
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRouter);
app.use(express.json());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60,
  message: { error: 'Trop de requêtes. Réessayez dans quelques minutes.' } });
const demoLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3,
  message: { error: 'Limite de démo atteinte. Créez un compte gratuit pour continuer.' } });

app.use('/api/', limiter);
app.use('/api/demo', demoLimiter);

// Routes
app.use('/api/analyse',  analyseRouter);
app.use('/api/payment',  paymentRouter);
app.use('/api/demo',     demoRouter);
app.use('/api/scrape',   scrapeRouter);
app.use('/api/alerts',   alertsRouter);
app.use('/api/share',    shareRouter);
app.use('/api/feedback',       feedbackRouter);
app.use('/api/payment-check',  paymentCheckRouter);
app.use('/api/community',      communityRouter);
app.use('/api/user',           userRouter);
app.use('/api/contact',    contactRouter);
app.get('/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log(`✅ Seculoca backend v2 démarré sur le port ${PORT}`));
