const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    material: { type: String },
    color: { type: String },
    occasion: { type: String },
    weight: { type: String },
    description: { type: String },
    images: [{ type: String }],
    stock: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.virtual('discountPercent').get(function () {
  if (!this.mrp || this.mrp <= this.price) return 0;
  return Math.round(((this.mrp - this.price) / this.mrp) * 100);
});
productSchema.set('toJSON', { virtuals: true });

// Text search index already exists for search queries.
productSchema.index({ name: 'text', description: 'text' });

// Index fields that are commonly used in product listing filters and sorting.
productSchema.index({ category: 1, isFeatured: 1, price: 1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
