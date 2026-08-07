const Return = require('../models/Return');
const Order = require('../models/Order');
const logger = require('../utils/logger');

// User: Request a return (after delivery)
async function userRequestReturn(req, res, next) {
  try {
    const { orderId, productId, reason, description } = req.body;

    if (!orderId || !productId || !reason) {
      return res.status(400).json({ success: false, message: 'orderId, productId, and reason are required' });
    }

    // Verify order belongs to user
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Verify order is delivered
    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Order must be delivered to request return' });
    }

    // Check if return is within 3 days of delivery
    const deliveryDate = order.deliveryDate || order.updatedAt;
    const daysDifference = Math.floor((new Date() - new Date(deliveryDate)) / (1000 * 60 * 60 * 24));
    if (daysDifference > 3) {
      return res.status(400).json({ success: false, message: 'Return window is only 3 days after delivery' });
    }

    // Check if return already exists
    const existingReturn = await Return.findOne({ order: orderId, product: productId, status: { $ne: 'rejected' } });
    if (existingReturn) {
      return res.status(400).json({ success: false, message: 'Return request already exists for this product' });
    }

    // Create return request
    const returnRequest = new Return({
      order: orderId,
      user: req.user._id,
      product: productId,
      reason,
      description,
      status: 'pending',
    });

    await returnRequest.save();
    logger.info('Return requested', { orderId, productId, userId: req.user._id });
    res.json({ success: true, message: 'Return request submitted', data: returnRequest });
  } catch (error) {
    logger.error('Error requesting return', { error: error.message });
    res.status(500).json({ success: false, message: 'Error requesting return' });
  }
}

// User: Get their returns
async function userGetReturns(req, res, next) {
  try {
    const returns = await Return.find({ user: req.user._id })
      .populate('order', 'orderNumber')
      .populate('product', 'name images')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: returns });
  } catch (error) {
    logger.error('Error fetching returns', { error: error.message });
    res.status(500).json({ success: false, message: 'Error fetching returns' });
  }
}

// User: Get return detail
async function userGetReturnDetail(req, res, next) {
  try {
    const returnRequest = await Return.findOne({ _id: req.params.id, user: req.user._id })
      .populate('order')
      .populate('product');

    if (!returnRequest) return res.status(404).json({ success: false, message: 'Return not found' });
    res.json({ success: true, data: returnRequest });
  } catch (error) {
    logger.error('Error fetching return', { error: error.message });
    res.status(500).json({ success: false, message: 'Error fetching return' });
  }
}

// Admin: Get all return requests
async function adminGetAllReturns(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Return.countDocuments(filter);
    const returns = await Return.find(filter)
      .populate('user', 'name email phone')
      .populate('order', 'orderNumber total')
      .populate('product', 'name price images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      data: returns,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) }
    });
  } catch (error) {
    logger.error('Error fetching returns', { error: error.message });
    res.status(500).json({ success: false, message: 'Error fetching returns' });
  }
}

// Admin: Approve return
async function adminApproveReturn(req, res, next) {
  try {
    const { adminNote, refundAmount } = req.body;
    
    const returnRequest = await Return.findById(req.params.id);
    if (!returnRequest) return res.status(404).json({ success: false, message: 'Return not found' });

    returnRequest.status = 'approved';
    returnRequest.approvedAt = new Date();
    if (adminNote) returnRequest.adminNote = adminNote;
    if (refundAmount) returnRequest.refundAmount = refundAmount;

    await returnRequest.save();
    logger.info('Return approved', { returnId: returnRequest._id });
    res.json({ success: true, message: 'Return approved', data: returnRequest });
  } catch (error) {
    logger.error('Error approving return', { error: error.message });
    res.status(500).json({ success: false, message: 'Error approving return' });
  }
}

// Admin: Reject return
async function adminRejectReturn(req, res, next) {
  try {
    const { adminNote } = req.body;
    
    const returnRequest = await Return.findById(req.params.id);
    if (!returnRequest) return res.status(404).json({ success: false, message: 'Return not found' });

    returnRequest.status = 'rejected';
    if (adminNote) returnRequest.adminNote = adminNote;

    await returnRequest.save();
    logger.info('Return rejected', { returnId: returnRequest._id });
    res.json({ success: true, message: 'Return rejected', data: returnRequest });
  } catch (error) {
    logger.error('Error rejecting return', { error: error.message });
    res.status(500).json({ success: false, message: 'Error rejecting return' });
  }
}

// Admin: Mark return as returned (goods received)
async function adminMarkReturned(req, res, next) {
  try {
    const returnRequest = await Return.findById(req.params.id);
    if (!returnRequest) return res.status(404).json({ success: false, message: 'Return not found' });

    returnRequest.status = 'returned';
    returnRequest.returnedAt = new Date();

    await returnRequest.save();
    logger.info('Return marked as returned', { returnId: returnRequest._id });
    res.json({ success: true, message: 'Return marked as returned', data: returnRequest });
  } catch (error) {
    logger.error('Error marking return', { error: error.message });
    res.status(500).json({ success: false, message: 'Error marking return' });
  }
}

// Admin: Process refund
async function adminProcessRefund(req, res, next) {
  try {
    const returnRequest = await Return.findById(req.params.id);
    if (!returnRequest) return res.status(404).json({ success: false, message: 'Return not found' });

    if (returnRequest.status !== 'returned') {
      return res.status(400).json({ success: false, message: 'Return must be marked as returned first' });
    }

    returnRequest.status = 'refunded';
    returnRequest.refundedAt = new Date();

    await returnRequest.save();
    logger.info('Return refunded', { returnId: returnRequest._id, amount: returnRequest.refundAmount });
    res.json({ success: true, message: 'Refund processed', data: returnRequest });
  } catch (error) {
    logger.error('Error processing refund', { error: error.message });
    res.status(500).json({ success: false, message: 'Error processing refund' });
  }
}

module.exports = {
  userRequestReturn,
  userGetReturns,
  userGetReturnDetail,
  adminGetAllReturns,
  adminApproveReturn,
  adminRejectReturn,
  adminMarkReturned,
  adminProcessRefund,
};
