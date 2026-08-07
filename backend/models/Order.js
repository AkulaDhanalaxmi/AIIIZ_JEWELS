const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  price: Number,
  qty: { type: Number, required: true, min: 1 },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    address: {
      name: String,
      phone: String,
      line: String,
      city: String,
      state: String,
      pincode: String,
    },
    paymentMethod: {
      type: String,
      enum: ['upi', 'card', 'netbanking', 'cod'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    customerName: { type: String },
    customerEmail: { type: String },
    subtotal: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    paidAt: { type: Date },
    paymentDetails: { type: String },
    deliveryDate: { type: Date },
    deliveryState: {
      type: String,
      enum: ['scheduled', 'on-time', 'delayed', 'out-of-stock', 'rescheduled'],
      default: 'scheduled',
    },
    deliveryNote: { type: String },
    reviewRequested: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'delayed', 'out-of-stock'],
      default: 'confirmed',
    },
    statusHistory: [
      {
        status: String,
        message: String,
        at: { type: Date, default: Date.now },
      },
    ],
    adminNote: { type: String },
    cancelReason: { type: String },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
