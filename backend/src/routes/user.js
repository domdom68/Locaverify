const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getUserPlanState, PLANS } = require('../lib/subscriptionManager');

// GET /api/user/plan — full plan state for dashboard
router.get('/plan', requireAuth, async (req, res) => {
  const state = await getUserPlanState(req.user.id);
  return res.json({ ...state, planInfo: PLANS[state.plan] || PLANS.free });
});

module.exports = router;
