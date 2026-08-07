const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    reason: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'returned', 'refunded'],
      default: 'pending',
      index: true,
    },
    adminNote: { type: String },
    approvedAt: { type: Date },
    returnedAt: { type: Date },
    refundedAt: { type: Date },
    refundAmount: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Return', returnSchema);
