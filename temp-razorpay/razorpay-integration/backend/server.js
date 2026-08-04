/**
 * server.js
 *
 * Entry point. The one non-obvious detail here is ordering: the
 * webhook route is mounted with its own raw-body JSON parser BEFORE
 * the app-wide express.json(), so Razorpay's signature check always
 * verifies against the exact bytes they sent.
 *
 * Install dependencies:
 *   npm install express mongoose dotenv razorpay cors helmet
 *   npm install express-validator express-rate-limit jsonwebtoken
 *   npm install morgan   (optional, request logging)
 */

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');

const paymentRoutes = require('./routes/paymentRoutes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// ---- Security & infra middleware --------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// ---- Mount payment routes BEFORE the global body parser ----------------
// paymentRoutes internally applies express.json() with a raw-body-saving
// verify hook ONLY on the /webhook path, and normal parsing is fine for
// the rest of the routes in that router since they don't need raw bytes.
app.use('/api/payments', paymentRoutes);

// ---- Global body parser for the rest of the app -------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Your other app routes go here --------------------------------------
// app.use('/api/auth', authRoutes);
// app.use('/api/orders', orderRoutes);
// app.use('/api/products', productRoutes);

// ---- Health check ---------------------------------------------------------
app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok' }));

// ---- 404 + error handling --------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.info('MongoDB connected');
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  });

// ---- Process-level safety nets ---------------------------------------------
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = app;
