/**
 * middleware/errorHandler.js
 *
 * Centralized error handler. Keeps stack traces out of production
 * responses and normalizes Razorpay SDK error shapes (which come
 * back as { statusCode, error: { description, code } }).
 */

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.originalUrl });

  // Razorpay SDK errors have this shape
  if (err.error && err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.error.description || 'Payment gateway error.',
      code: err.error.code,
    });
  }

  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
