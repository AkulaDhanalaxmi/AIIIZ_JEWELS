const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/settingController');

router.get('/:key', ctrl.getSetting);
router.put('/:key', protect, adminOnly, ctrl.saveSetting);

module.exports = router;
