const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    razorpayOrderId: { type: String, required: true, index: true, unique: true },
    razorpayPaymentId: { type: String, index: true, sparse: true },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },
    method: { type: String },
    status: {
      type: String,
      enum: ['CREATED', 'ATTEMPTED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'],
      default: 'CREATED',
      index: true,
    },
    errorCode: { type: String },
    errorDescription: { type: String },
    verified: { type: Boolean, default: false },
    rawPayload: { type: mongoose.Schema.Types.Mixed },
    initiatedFromIp: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
