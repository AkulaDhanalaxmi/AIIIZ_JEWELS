const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);
router.post('/', ctrl.placeOrder);
router.get('/', ctrl.myOrders);
router.get('/admin/all', adminOnly, ctrl.allOrders);
router.get('/:id', ctrl.getOne);
router.put('/:id/status', adminOnly, ctrl.updateStatus);
router.post('/:id/cancel', ctrl.cancelOrder);

module.exports = router;
