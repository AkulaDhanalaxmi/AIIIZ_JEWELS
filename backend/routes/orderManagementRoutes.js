const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  adminGetAllOrders,
  adminGetOrderDetail,
  adminUpdateOrderStatus,
  adminUpdateDeliveryDate,
  getUserOrders,
  getUserOrderDetail,
} = require('../controllers/orderManagementController');

// Admin routes
router.get('/admin/all', protect, adminOnly, adminGetAllOrders);
router.get('/admin/:id', protect, adminOnly, adminGetOrderDetail);
router.patch('/admin/:id/status', protect, adminOnly, adminUpdateOrderStatus);
router.patch('/admin/:id/delivery', protect, adminOnly, adminUpdateDeliveryDate);

// User routes
router.get('/user/my-orders', protect, getUserOrders);
router.get('/user/:id', protect, getUserOrderDetail);

module.exports = router;
