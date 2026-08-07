const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  userRequestReturn,
  userGetReturns,
  userGetReturnDetail,
  adminGetAllReturns,
  adminApproveReturn,
  adminRejectReturn,
  adminMarkReturned,
  adminProcessRefund,
} = require('../controllers/returnController');

// User routes
router.post('/user/request', protect, userRequestReturn);
router.get('/user/my-returns', protect, userGetReturns);
router.get('/user/:id', protect, userGetReturnDetail);

// Admin routes
router.get('/admin/all', protect, adminOnly, adminGetAllReturns);
router.patch('/admin/:id/approve', protect, adminOnly, adminApproveReturn);
router.patch('/admin/:id/reject', protect, adminOnly, adminRejectReturn);
router.patch('/admin/:id/mark-returned', protect, adminOnly, adminMarkReturned);
router.patch('/admin/:id/process-refund', protect, adminOnly, adminProcessRefund);

module.exports = router;
