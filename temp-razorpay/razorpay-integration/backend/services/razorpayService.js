/**
 * services/razorpayService.js
 *
 * All direct interaction with the Razorpay SDK/API lives here.
 * Controllers should never touch `crypto` or the Razorpay instance
 * directly — this isolation makes it trivial to unit test and to
 * swap/upgrade the SDK without touching request-handling code.
 */

const crypto = require('crypto');
const razorpay = require('../config/razorpay');

const CURRENCY = process.env.RAZORPAY_CURRENCY || 'INR';

/**
 * Convert a rupee amount (major unit, can have paise as decimals)
 * into the integer paise value Razorpay's API requires.
 * Using Math.round avoids floating point artifacts like 499.9999999.
 */
function toSmallestUnit(amountInRupees) {
  return Math.round(Number(amountInRupees) * 100);
}

/**
 * Creates a Razorpay Order. This MUST happen server-side — the
 * amount is taken from data we trust (the Order document we looked
 * up ourselves), never from anything the client sends, so a
 * tampered client-side amount can never result in an under-charge.
 *
 * @param {Object} params
 * @param {number} params.amountInRupees
 * @param {string} params.receipt - your internal order id / reference
 * @param {Object} [params.notes] - arbitrary metadata, visible in dashboard
 */
async function createRazorpayOrder({ amountInRupees, receipt, notes = {} }) {
  const options = {
    amount: toSmallestUnit(amountInRupees),
    currency: CURRENCY,
    receipt,
    notes,
    payment_capture: 1, // auto-capture on successful authorization
  };

  const razorpayOrder = await razorpay.orders.create(options);
  return razorpayOrder;
}

/**
 * Verifies the signature Razorpay Checkout returns to the frontend
 * after a successful payment (the `handler` callback payload).
 *
 * Formula per Razorpay docs:
 *   expected_signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 *
 * Uses a timing-safe comparison to avoid timing side-channel leaks.
 */
function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return safeCompare(expectedSignature, razorpaySignature);
}

/**
 * Verifies the `X-Razorpay-Signature` header on incoming webhook
 * requests against the raw request body, using the separate
 * webhook secret configured in the Razorpay Dashboard.
 *
 * IMPORTANT: `rawBody` must be the exact, unparsed request body
 * bytes/string Razorpay signed — see middleware/webhookRawBody.js.
 */
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return safeCompare(expectedSignature, signatureHeader);
}

/**
 * Constant-time string comparison to prevent timing attacks on
 * signature verification. Falls back to false on length mismatch
 * (timingSafeEqual throws if buffer lengths differ).
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Fetches the authoritative payment entity from Razorpay's API.
 * Used as a double-check after signature verification and inside
 * webhook handlers when we need full payment details (method,
 * card/bank/wallet info, etc.) beyond what the event payload has.
 */
async function fetchPaymentById(paymentId) {
  return razorpay.payments.fetch(paymentId);
}

/**
 * Issues a refund for a captured payment. Amount is optional —
 * omit for a full refund, or pass rupees for a partial refund.
 */
async function refundPayment(paymentId, amountInRupees) {
  const payload = {};
  if (amountInRupees != null) {
    payload.amount = toSmallestUnit(amountInRupees);
  }
  return razorpay.payments.refund(paymentId, payload);
}

module.exports = {
  toSmallestUnit,
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPaymentById,
  refundPayment,
};
