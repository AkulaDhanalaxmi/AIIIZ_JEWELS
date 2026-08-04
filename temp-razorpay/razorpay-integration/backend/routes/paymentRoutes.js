/**
 * routes/paymentRoutes.js
 *
 * NOTE on mounting the webhook route: the raw-body-preserving JSON
 * parser (webhookRawBody) must be used for /webhook, and it must be
 * mounted BEFORE any global `express.json()` body parser touches
 * this route. The cleanest way is to mount this router's webhook
 * path ahead of app.use(express.json()) in server.js — see the
 * comment there. If you mount this whole router after the global
 * json parser, the webhook signature check will fail because the
 * body has already been parsed and re-serialization won't match
 * Razorpay's original bytes.
 */

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { createOrderLimiter, verifyLimiter } = require('../middleware/rateLimiter');
const rawBodySaver = require('../middleware/webhookRawBody');
const {
  createOrderValidator,
  verifyPaymentValidator,
  paymentFailureValidator,
  orderIdParamValidator,
} = require('../utils/validators');

const {
  createPaymentOrder,
  verifyPayment,
  recordPaymentFailure,
  getPaymentStatus,
  handleWebhook,
} = require('../controllers/paymentController');

// ---- Authenticated, user-facing endpoints -----------------------------

router.post('/create-order', protect, createOrderLimiter, createOrderValidator, createPaymentOrder);

router.post('/verify', protect, verifyLimiter, verifyPaymentValidator, verifyPayment);

router.post('/failure', protect, paymentFailureValidator, recordPaymentFailure);

router.get('/status/:orderId', protect, orderIdParamValidator, getPaymentStatus);

// ---- Server-to-server webhook (NOT behind `protect` — Razorpay calls
// this directly; it authenticates itself via the signature header) ----

router.post('/webhook', express.json({ verify: rawBodySaver }), handleWebhook);

module.exports = router;
