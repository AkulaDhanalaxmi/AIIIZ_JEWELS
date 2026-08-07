const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function shapeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    addresses: user.addresses,
  };
}

// POST /api/auth/register
exports.register = async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: 'Email already registered' });

  const user = await User.create({ name, email, password, phone });
  const token = signToken(user);
  res.status(201).json({ token, user: shapeUser(user) });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  const token = signToken(user);
  res.json({ token, user: shapeUser(user) });
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const user = await User.findOne({ email });
  const message = 'If an account exists for that email, a reset link has been sent.';
  if (!user) return res.json({ message });

  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetUrl = `${clientUrl}/#/auth?mode=reset-password&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  const html = `
    <p>Hi ${user.name || 'there'},</p>
    <p>You recently requested to reset your Aiiz password. Click the link below to set a new password. This link expires in 30 minutes.</p>
    <p><a href="${resetUrl}" target="_blank" style="color:#1c64f2;">Reset your password</a></p>
    <p>If you did not request this, you can safely ignore this email.</p>
    <p>Thanks,<br/>Aiiz Team</p>
  `;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Aiiz Password Reset',
      html,
      text: `Reset your password by visiting: ${resetUrl}`,
    });
    res.json({ message });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.error('Password reset email error:', error);
    if (error.code === 'EMAIL_CONFIG_MISSING') {
  return res.status(503).json({ message: 'Email delivery is not configured yet. Set RESEND_API_KEY in the backend environment to enable password reset emails.' });
}
    res.status(500).json({ message: 'Could not send reset link. Please try again later.' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  const { email, token, password, confirmPassword } = req.body;
  if (!email || !token || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Email, token, password and confirm password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    email,
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+password');

  if (!user) {
    return res.status(400).json({ message: 'Reset token is invalid or has expired' });
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  const jwtToken = signToken(user);
  res.json({ token: jwtToken, user: shapeUser(user), message: 'Password reset successfully' });
};

// POST /api/auth/google
exports.google = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'ID token is required' });
    }

    // Verify the token server-side using google-auth-library
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      return res.status(401).json({ message: 'Invalid or expired Google credential' });
    }

    if (!payload.email_verified) {
      return res.status(400).json({ message: 'Google account email is not verified' });
    }

    // Find or create user
    let user = await User.findOne({ email: payload.email });
    if (!user) {
      user = await User.create({
        name: payload.name || 'User',
        email: payload.email,
        googleId: payload.sub,
        authProvider: 'google',
        phone: '',
      });
    } else if (!user.googleId) {
      // Existing email-based user; optionally link Google ID
      user.googleId = payload.sub;
      if (user.authProvider === 'email') {
        user.authProvider = 'google'; // or keep as 'email' if you want to allow both
      }
      await user.save();
    }

    const token = signToken(user);
    res.json({ token, user: shapeUser(user) });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ message: 'Google authentication failed' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ user: shapeUser(req.user) });
};
