/**
 * utils/validators.js
 *
 * Request validation using express-validator.
 * Install with: npm install express-validator
 */

const { body, param, validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

const createOrderValidator = [
  body('orderId')
    .notEmpty()
    .withMessage('orderId is required')
    .isMongoId()
    .withMessage('orderId must be a valid id'),
  handleValidationErrors,
];

const verifyPaymentValidator = [
  body('razorpay_order_id').notEmpty().withMessage('razorpay_order_id is required').isString(),
  body('razorpay_payment_id').notEmpty().withMessage('razorpay_payment_id is required').isString(),
  body('razorpay_signature').notEmpty().withMessage('razorpay_signature is required').isString(),
  body('orderId').notEmpty().withMessage('orderId is required').isMongoId(),
  handleValidationErrors,
];

const paymentFailureValidator = [
  body('razorpay_order_id').notEmpty().withMessage('razorpay_order_id is required').isString(),
  body('orderId').notEmpty().withMessage('orderId is required').isMongoId(),
  body('error').optional().isObject(),
  handleValidationErrors,
];

const orderIdParamValidator = [
  param('orderId').isMongoId().withMessage('Invalid order id'),
  handleValidationErrors,
];

module.exports = {
  createOrderValidator,
  verifyPaymentValidator,
  paymentFailureValidator,
  orderIdParamValidator,
};
