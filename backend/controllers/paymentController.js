const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');
const razorpayService = require('../services/razorpayService');
const logger = require('../utils/logger');

async function createPaymentOrder(req, res, next) {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay for this order.' });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(409).json({ success: false, message: 'This order has already been paid.' });
    }

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
          prefill: {
            name: req.user.name,
            email: req.user.email,
            contact: req.user.phone || '',
          },
        },
      });
    }

    const razorpayOrder = await razorpayService.createRazorpayOrder({
      amountInRupees: order.total,
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
      amount: razorpayOrder.amount,
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

      order.paymentStatus = 'paid';
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
    if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'failed';
      await order.save();
    }
    logger.warn('Payment failure recorded from client', { orderId: order._id.toString(), error });
    return res.status(200).json({ success: true, message: 'Failure recorded.' });
  } catch (err) {
    next(err);
  }
}

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
    logger.error('Webhook processing error', { error: err.message });
    next(err);
  }
}

async function handlePaymentCaptured(event, fromOrderPaid = false) {
  const paymentEntity = event.payload.payment.entity;
  const razorpayOrderId = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;
  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) {
    logger.warn('Webhook payment.captured for unknown razorpayOrderId', { razorpayOrderId });
    return;
  }
  if (payment.status === 'PAID' && payment.verified) return;
  payment.razorpayPaymentId = razorpayPaymentId;
  payment.status = 'PAID';
  payment.verified = true;
  payment.method = paymentEntity.method;
  payment.rawPayload = paymentEntity;
  await payment.save();
  const order = await Order.findById(payment.order);
  if (order && order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
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
  if (payment.status === 'PAID') return;
  payment.status = 'FAILED';
  payment.errorCode = paymentEntity.error_code;
  payment.errorDescription = paymentEntity.error_description;
  payment.rawPayload = paymentEntity;
  await payment.save();
  const order = await Order.findById(payment.order);
  if (order && order.paymentStatus !== 'paid') {
    order.paymentStatus = 'failed';
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
    order.paymentStatus = 'refunded';
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
