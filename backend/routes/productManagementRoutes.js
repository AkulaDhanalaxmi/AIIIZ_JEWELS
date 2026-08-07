const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  adminUpdateProductStock,
  adminGetAllProducts,
  adminGetProductDetail,
  getUserProduct,
} = require('../controllers/productManagementController');

// Admin routes
router.patch('/admin/:id/stock', protect, adminOnly, adminUpdateProductStock);
router.get('/admin/all', protect, adminOnly, adminGetAllProducts);
router.get('/admin/:id', protect, adminOnly, adminGetProductDetail);

// User routes
router.get('/user/:id', getUserProduct);

module.exports = router;
