const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    icon: { type: String, default: 'ring' },
    image: { type: String },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  },
  { timestamps: true }
);

categorySchema.index({ parent: 1, slug: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Category', categorySchema);
