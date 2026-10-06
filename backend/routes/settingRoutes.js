const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/settingController');

router.get('/promotional', ctrl.getPromotionalBanners);
router.get('/promotional/admin', protect, adminOnly, ctrl.getAdminPromotionalBanners);
router.post('/promotional', protect, adminOnly, ctrl.createPromotionalBanner);
router.put('/promotional/order', protect, adminOnly, ctrl.reorderPromotionalBanners);
router.put('/promotional/:id', protect, adminOnly, ctrl.updatePromotionalBanner);
router.delete('/promotional/:id', protect, adminOnly, ctrl.deletePromotionalBanner);

router.get('/:key', ctrl.getSetting);
router.put('/:key', protect, adminOnly, ctrl.saveSetting);

module.exports = router;
