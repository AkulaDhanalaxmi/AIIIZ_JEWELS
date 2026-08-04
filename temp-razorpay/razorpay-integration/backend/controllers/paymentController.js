/**
 * controllers/paymentController.js
 *
 * Request handlers for the payment flow. Business rules enforced here:
 *
 *  1. Orders are only ever marked PAID after a backend signature
 *     verification succeeds (checkout handler path) OR a verified
 *     webhook event confirms it (webhook path) — never from the
 *     client telling us "payment succeeded".
 *  2. A user can only create/verify payments for their own orders.
 *  3. All Razorpay amounts are derived from the Order document we
 *     already trust in our DB, never from client-supplied amounts.
 *  4. Webhook events are idempotent — replays never double-apply.
 */

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');
const razorpayService = require('../services/razorpayService');
const logger = require('../utils/logger');

/**
 * POST /api/payments/create-order
 * Body: { orderId }
 *
 * Looks up the Order, creates a matching Razorpay Order for its
 * total, and persists a Payment record in CREATED state. Returns
 * the data the frontend needs to open Razorpay Checkout.
 */
async function createPaymentOrder(req, res, next) {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Ownership check — a user may only pay for their own order.
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay for this order.' });
    }

    if (order.paymentStatus === 'PAID') {
      return res.status(409).json({ success: false, message: 'This order has already been paid.' });
    }

    // Idempotency: if a still-valid Razorpay order already exists for
    // this Order and hasn't been paid/cancelled, reuse it instead of
    // minting a fresh one on every checkout page reload.
    const existingPayment = await Payment.findOne({
      order: order._id,
      status: { $in: ['CREATED', 'ATTEMPTED'] },
    }).sort({ createdAt: -1 });

    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: 'Existing pending payment order reused.',
        data: {
          razorpayOrderId: existingPayment.razorpayOrderId,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          keyId: process.env.RAZORPAY_KEY_ID,
          orderId: order._id,
        },
      });
    }

    const razorpayOrder = await razorpayService.createRazorpayOrder({
      amountInRupees: order.totalPrice,
      receipt: `receipt_order_${order._id}`,
      notes: {
        orderId: order._id.toString(),
        userId: req.user._id.toString(),
      },
    });

    const payment = await Payment.create({
      order: order._id,
      user: req.user._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // paise, as returned by Razorpay
      currency: razorpayOrder.currency,
      status: 'CREATED',
      initiatedFromIp: req.ip,
    });

    order.payment = payment._id;
    await order.save();

    logger.info('Razorpay order created', { orderId: order._id.toString(), razorpayOrderId: razorpayOrder.id });

    return res.status(201).json({
      success: true,
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order._id,
        // Prefill helps Checkout pre-populate contact details.
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone || '',
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId }
 *
 * Called from the Razorpay Checkout `handler` callback on the
 * frontend after a successful payment. This is the ONLY place
 * (besides the webhook) that may flip an order to PAID.
 */
async function verifyPayment(req, res, next) {
  const session = await mongoose.startSession();
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this order.' });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, order: order._id });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this order.' });
    }

    const isValidSignature = razorpayService.verifyPaymentSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    if (!isValidSignature) {
      payment.status = 'FAILED';
      payment.errorDescription = 'Signature verification failed';
      await payment.save();

      logger.warn('Payment signature verification failed', {
        orderId: order._id.toString(),
        razorpayOrderId: razorpay_order_id,
      });

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. If money was deducted, it will be auto-refunded by Razorpay.',
      });
    }

    // Double-check against Razorpay's own API as defense in depth —
    // confirms the payment is actually captured, not just that the
    // signature is well-formed.
    const razorpayPayment = await razorpayService.fetchPaymentById(razorpay_payment_id);

    if (!['captured', 'authorized'].includes(razorpayPayment.status)) {
      payment.status = 'FAILED';
      payment.errorDescription = `Unexpected payment status from Razorpay: ${razorpayPayment.status}`;
      payment.rawPayload = razorpayPayment;
      await payment.save();

      return res.status(400).json({
        success: false,
        message: 'Payment has not been successfully captured yet.',
      });
    }

    await session.withTransaction(async () => {
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.status = 'PAID';
      payment.verified = true;
      payment.method = razorpayPayment.method;
      payment.rawPayload = razorpayPayment;
      await payment.save({ session });

      order.paymentStatus = 'PAID';
      order.orderStatus = 'PAID';
      order.paidAt = new Date();
      order.payment = payment._id;
      await order.save({ session });
    });

    logger.info('Payment verified and order marked PAID', {
      orderId: order._id.toString(),
      razorpayPaymentId: razorpay_payment_id,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully.',
      data: {
        orderId: order._id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        razorpayPaymentId: razorpay_payment_id,
      },
    });
  } catch (err) {
    next(err);
  } finally {
    session.endSession();
  }
}

/**
 * POST /api/payments/failure
 * Body: { razorpay_order_id, orderId, error }
 *
 * Called from Checkout's `payment.failed` event handler on the
 * frontend so we record the failure immediately rather than waiting
 * on the webhook (which is still the authoritative backstop).
 */
async function recordPaymentFailure(req, res, next) {
  try {
    const { razorpay_order_id, orderId, error } = req.body;

    const order = await Order.findById(orderId);
    if (!order || order.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, order: order._id });
    if (payment && payment.status !== 'PAID') {
      payment.status = 'FAILED';
      payment.errorCode = error?.code;
      payment.errorDescription = error?.description || error?.reason;
      await payment.save();
    }

    if (order.paymentStatus !== 'PAID') {
      order.paymentStatus = 'FAILED';
      order.orderStatus = 'PAYMENT_FAILED';
      await order.save();
    }

    logger.warn('Payment failure recorded from client', { orderId: order._id.toString(), error });

    return res.status(200).json({ success: true, message: 'Failure recorded.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/status/:orderId
 * Lets the frontend poll for the current authoritative status —
 * useful for UPI/net-banking flows where the redirect can lag
 * behind the webhook.
 */
async function getPaymentStatus(req, res, next) {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate('payment');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this order.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        razorpayPaymentId: order.payment?.razorpayPaymentId || null,
        razorpayOrderId: order.payment?.razorpayOrderId || null,
        method: order.payment?.method || null,
        paidAt: order.paidAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/payments/webhook
 *
 * Razorpay's server-to-server notification. This is the SOURCE OF
 * TRUTH for payment state in production — the client-side `verify`
 * call above is a UX optimization for instant feedback, but a user
 * closing their browser mid-flow, network drops, etc. must not be
 * able to leave an order in limbo. The webhook always catches up.
 *
 * Must be mounted with the raw-body-preserving JSON parser — see
 * middleware/webhookRawBody.js and routes/paymentRoutes.js.
 *
 * Configure this URL in Razorpay Dashboard > Settings > Webhooks,
 * subscribing at minimum to: payment.captured, payment.failed,
 * order.paid.
 */
async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody;

    if (!rawBody) {
      logger.error('Webhook raw body missing — check middleware order.');
      return res.status(400).json({ success: false, message: 'Invalid request.' });
    }

    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.warn('Webhook signature verification failed.');
      return res.status(400).json({ success: false, message: 'Invalid signature.' });
    }

    const event = req.body;
    const eventId = req.headers['x-razorpay-event-id'] || `${event.event}_${event.created_at}`;

    // Idempotency guard: acknowledge duplicates without reprocessing.
    const alreadyProcessed = await WebhookEvent.findOne({ eventId });
    if (alreadyProcessed) {
      return res.status(200).json({ success: true, message: 'Event already processed.' });
    }

    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event);
        break;
      case 'order.paid':
        await handlePaymentCaptured(event, true);
        break;
      case 'refund.processed':
        await handleRefundProcessed(event);
        break;
      default:
        logger.info('Unhandled webhook event type', { type: event.event });
    }

    await WebhookEvent.create({ eventId, eventType: event.event, payload: event });

    return res.status(200).json({ success: true });
  } catch (err) {
    // Respond 200 is tempting to "stop retries", but on unexpected
    // errors we WANT Razorpay to retry, so we surface a 500 here and
    // let the idempotency check above protect us on the replay.
    logger.error('Webhook processing error', { error: err.message });
    next(err);
  }
}

async function handlePaymentCaptured(event, fromOrderPaid = false) {
  const paymentEntity = fromOrderPaid
    ? event.payload.payment.entity
    : event.payload.payment.entity;
  const razorpayOrderId = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;

  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) {
    logger.warn('Webhook payment.captured for unknown razorpayOrderId', { razorpayOrderId });
    return;
  }

  // Don't downgrade or duplicate-process an already-verified payment.
  if (payment.status === 'PAID' && payment.verified) return;

  payment.razorpayPaymentId = razorpayPaymentId;
  payment.status = 'PAID';
  payment.verified = true;
  payment.method = paymentEntity.method;
  payment.rawPayload = paymentEntity;
  await payment.save();

  const order = await Order.findById(payment.order);
  if (order && order.paymentStatus !== 'PAID') {
    order.paymentStatus = 'PAID';
    order.orderStatus = 'PAID';
    order.paidAt = new Date();
    order.payment = payment._id;
    await order.save();
  }

  logger.info('Webhook confirmed payment captured', { razorpayOrderId, razorpayPaymentId });
}

async function handlePaymentFailed(event) {
  const paymentEntity = event.payload.payment.entity;
  const razorpayOrderId = paymentEntity.order_id;

  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) {
    logger.warn('Webhook payment.failed for unknown razorpayOrderId', { razorpayOrderId });
    return;
  }
  if (payment.status === 'PAID') return; // never downgrade a confirmed payment

  payment.status = 'FAILED';
  payment.errorCode = paymentEntity.error_code;
  payment.errorDescription = paymentEntity.error_description;
  payment.rawPayload = paymentEntity;
  await payment.save();

  const order = await Order.findById(payment.order);
  if (order && order.paymentStatus !== 'PAID') {
    order.paymentStatus = 'FAILED';
    order.orderStatus = 'PAYMENT_FAILED';
    await order.save();
  }

  logger.info('Webhook confirmed payment failed', { razorpayOrderId });
}

async function handleRefundProcessed(event) {
  const refundEntity = event.payload.refund.entity;
  const razorpayPaymentId = refundEntity.payment_id;

  const payment = await Payment.findOne({ razorpayPaymentId });
  if (!payment) return;

  payment.status = 'REFUNDED';
  await payment.save();

  const order = await Order.findById(payment.order);
  if (order) {
    order.paymentStatus = 'REFUNDED';
    await order.save();
  }

  logger.info('Webhook confirmed refund processed', { razorpayPaymentId });
}

module.exports = {
  createPaymentOrder,
  verifyPayment,
  recordPaymentFailure,
  getPaymentStatus,
  handleWebhook,
};
