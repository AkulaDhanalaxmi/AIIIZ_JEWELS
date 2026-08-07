const express = require('express');
const router = express.Router();
const { register, login, google, me, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/test', (req, res) => {
  res.json({
    message: 'Auth route working',
    file: __filename
  });
});
router.post('/google', google);
router.get('/me', protect, me);

module.exports = router;
