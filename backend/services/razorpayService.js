const crypto = require('crypto');
const razorpay = require('../config/razorpay');

const CURRENCY = process.env.RAZORPAY_CURRENCY || 'INR';

function toSmallestUnit(amountInRupees) {
  return Math.round(Number(amountInRupees) * 100);
}

async function createRazorpayOrder({ amountInRupees, receipt, notes = {} }) {
  const options = {
    amount: toSmallestUnit(amountInRupees),
    currency: CURRENCY,
    receipt,
    notes,
    payment_capture: 1,
  };

  return razorpay.orders.create(options);
}

function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return safeCompare(expectedSignature, razorpaySignature);
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return safeCompare(expected, signatureHeader);
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function fetchPaymentById(paymentId) {
  return razorpay.payments.fetch(paymentId);
}

async function refundPayment(paymentId, amountInRupees) {
  const payload = {};
  if (amountInRupees != null) {
    payload.amount = toSmallestUnit(amountInRupees);
  }
  return razorpay.payments.refund(paymentId, payload);
}

module.exports = {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPaymentById,
  refundPayment,
};
