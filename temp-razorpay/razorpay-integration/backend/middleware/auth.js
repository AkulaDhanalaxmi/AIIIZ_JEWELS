/**
 * middleware/auth.js
 *
 * Minimal JWT auth guard. Most MERN apps already have one of these —
 * wire this into your existing implementation, or use as-is.
 * Payment routes (aside from the webhook) MUST sit behind this:
 * a payment must always be tied to an authenticated, known user.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User'); // adjust path to your existing User model

async function protect(req, res, next) {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

module.exports = { protect };
