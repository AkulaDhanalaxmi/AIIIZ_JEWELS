/**
 * middleware/rateLimiter.js
 *
 * Install with: npm install express-rate-limit
 *
 * Payment endpoints are a prime target for abuse (order-creation
 * spam, brute-forcing verification). Keep limits tight and scoped
 * per-route rather than applying one global limiter.
 */

const rateLimit = require('express-rate-limit');

const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 order-creation attempts per user/IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment attempts. Please try again in a few minutes.',
  },
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again in a few minutes.',
  },
});

module.exports = { createOrderLimiter, verifyLimiter };
