/**
 * models/Order.js
 *
 * Represents a commerce order in your store. Kept deliberately
 * decoupled from Razorpay-specific fields (those live on Payment)
 * so an order can, in principle, be paid through more than one
 * gateway in the future.
 */

const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // unit price in rupees
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: 'IN' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    shippingAddress: { type: shippingAddressSchema, required: true },

    // Amount in rupees (major unit). Razorpay itself deals in paise;
    // conversion happens only at the service boundary.
    itemsPrice: { type: Number, required: true, min: 0 },
    shippingPrice: { type: Number, required: true, default: 0, min: 0 },
    taxPrice: { type: Number, required: true, default: 0, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },

    currency: { type: String, required: true, default: 'INR' },

    // Order lifecycle - independent from payment status so that,
    // e.g., a paid order can still be "processing" for fulfilment.
    orderStatus: {
      type: String,
      enum: ['CREATED', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED'],
      default: 'CREATED',
      index: true,
    },

    // Denormalized payment status kept in sync by the payment
    // service, so order lists don't need a join for the common case.
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },

    // Reference to the current authoritative Payment document.
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },

    paidAt: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
