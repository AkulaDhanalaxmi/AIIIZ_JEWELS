/**
 * routes/paymentRoutes.js
 */

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { createOrderLimiter, verifyLimiter } = require('../middleware/rateLimiter');
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
  adminGetAllPayments,
} = require('../controllers/paymentController');

router.post('/create-order', protect, createOrderLimiter, createOrderValidator, createPaymentOrder);
router.post('/verify', protect, verifyLimiter, verifyPaymentValidator, verifyPayment);
router.post('/failure', protect, paymentFailureValidator, recordPaymentFailure);
router.get('/status/:orderId', protect, orderIdParamValidator, getPaymentStatus);
router.post('/webhook', handleWebhook);
router.get('/admin/all', protect, adminGetAllPayments);

module.exports = router;
