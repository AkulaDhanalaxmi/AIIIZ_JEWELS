/**
 * models/Payment.js
 *
 * The authoritative record of a Razorpay transaction attempt.
 * One Order can have multiple Payment documents over its lifetime
 * (e.g. a failed attempt followed by a successful retry) — this
 * model captures each attempt rather than overwriting state, which
 * is essential for audit trails and dispute handling.
 */

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Razorpay identifiers
    razorpayOrderId: { type: String, required: true, index: true, unique: true },
    razorpayPaymentId: { type: String, index: true, sparse: true },
    razorpaySignature: { type: String },

    // Amount in the smallest currency unit (paise for INR), exactly
    // as sent to / received from Razorpay. Avoids float rounding bugs.
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },

    method: {
      type: String, // e.g. 'upi', 'card', 'netbanking', 'wallet', 'emi'
    },

    status: {
      type: String,
      enum: ['CREATED', 'ATTEMPTED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'],
      default: 'CREATED',
      index: true,
    },

    // Raw error info from Razorpay on failure (handler failure payload
    // or webhook payment.failed event), kept for support/debugging.
    errorCode: { type: String },
    errorDescription: { type: String },

    // Whether this payment has been through backend signature
    // verification. An order is only ever marked PAID when this is true.
    verified: { type: Boolean, default: false },

    // Free-form snapshot of the last Razorpay payment entity fetched
    // via API or webhook, for audit / support purposes.
    rawPayload: { type: mongoose.Schema.Types.Mixed },

    // IP / user agent captured at order-creation time, useful for
    // fraud review.
    initiatedFromIp: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
