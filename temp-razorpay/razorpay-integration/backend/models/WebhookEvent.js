/**
 * models/WebhookEvent.js
 *
 * Razorpay can (and will, per their own docs) redeliver the same
 * webhook event on retries. We persist every event id we have
 * successfully processed so handlers stay idempotent — replaying
 * an event must never double-credit an order or double-write state.
 */

const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
