/**
 * config/razorpay.js
 *
 * Single, shared instance of the official Razorpay Node SDK.
 * Install with: npm install razorpay
 *
 * Fails fast on boot if credentials are missing so that a
 * misconfigured deployment never silently accepts payments.
 */

const Razorpay = require('razorpay');

const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  throw new Error(
    'Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variables. ' +
      'Set them in your .env file before starting the server.'
  );
}

const razorpayInstance = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

module.exports = razorpayInstance;
