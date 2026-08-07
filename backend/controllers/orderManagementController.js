const Order = require('../models/Order');
const logger = require('../utils/logger');

// Admin: Get all orders
async function adminGetAllOrders(req, res, next) {
  try {
    const { status, paymentStatus, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('user', 'name email phone')
      .populate('items.product', 'name price images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      data: orders,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) }
    });
  } catch (error) {
    logger.error('Error fetching orders', { error: error.message });
    res.status(500).json({ success: false, message: 'Error fetching orders' });
  }
}

// Admin: Get order details
async function adminGetOrderDetail(req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product')
      .populate('payment');
    
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (error) {
    logger.error('Error fetching order detail', { error: error.message });
    res.status(500).json({ success: false, message: 'Error fetching order' });
  }
}

// Admin: Update order status
async function adminUpdateOrderStatus(req, res, next) {
  try {
    const { status, message, adminNote } = req.body;
    
    if (!status) return res.status(400).json({ success: false, message: 'Status required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const oldStatus = order.status;
    order.status = status;
    if (adminNote) order.adminNote = adminNote;
    if (status === 'cancelled' && !order.cancelledAt) {
      order.cancelledAt = new Date();
    }

    order.statusHistory.push({
      status,
      message: message || `Status changed from ${oldStatus} to ${status}`,
      at: new Date(),
    });

    await order.save();
    
    logger.info('Order status updated', { orderId: order._id, oldStatus, newStatus: status });
    res.json({ success: true, message: 'Order status updated', data: order });
  } catch (error) {
    logger.error('Error updating order status', { error: error.message });
    res.status(500).json({ success: false, message: 'Error updating order status' });
  }
}

// Admin: Update delivery date
async function adminUpdateDeliveryDate(req, res, next) {
  try {
    const { deliveryDate, deliveryState, deliveryNote } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (deliveryDate) order.deliveryDate = new Date(deliveryDate);
    if (deliveryState) order.deliveryState = deliveryState;
    if (deliveryNote) order.deliveryNote = deliveryNote;

    await order.save();
    logger.info('Order delivery info updated', { orderId: order._id });
    res.json({ success: true, message: 'Delivery info updated', data: order });
  } catch (error) {
    logger.error('Error updating delivery info', { error: error.message });
    res.status(500).json({ success: false, message: 'Error updating delivery info' });
  }
}

// User: Get their orders with details
async function getUserOrders(req, res, next) {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name price images')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Error fetching user orders', { error: error.message });
    res.status(500).json({ success: false, message: 'Error fetching orders' });
  }
}

// User: Get single order detail
async function getUserOrderDetail(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
      .populate('items.product')
      .populate('payment');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (error) {
    logger.error('Error fetching order detail', { error: error.message });
    res.status(500).json({ success: false, message: 'Error fetching order' });
  }
}

module.exports = {
  adminGetAllOrders,
  adminGetOrderDetail,
  adminUpdateOrderStatus,
  adminUpdateDeliveryDate,
  getUserOrders,
  getUserOrderDetail,
};
