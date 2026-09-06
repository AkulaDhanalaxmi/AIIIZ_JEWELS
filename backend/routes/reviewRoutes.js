const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reviewController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/:productId', ctrl.listByProduct);
router.post('/', protect, ctrl.create);
router.post('/admin', protect, adminOnly, ctrl.createAdminReview);
router.delete('/product/:productId', protect, adminOnly, ctrl.removeByProduct);
router.delete('/:id', protect, ctrl.remove);

module.exports = router;
