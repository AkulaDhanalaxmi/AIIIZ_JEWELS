const Review = require('../models/Review');
const Product = require('../models/Product');

// GET /api/reviews/:productId
exports.listByProduct = async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId }).sort({ createdAt: -1 });
  res.json({ reviews });
};

// POST /api/reviews  (logged-in users)
exports.create = async (req, res) => {
  const { productId, rating, comment } = req.body;
  if (!productId || !rating) return res.status(400).json({ message: 'productId and rating are required' });

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const already = await Review.findOne({ product: productId, user: req.user._id });
  if (already) return res.status(409).json({ message: 'You have already reviewed this product' });

  const review = await Review.create({
    product: productId,
    user: req.user._id,
    name: req.user.name,
    rating: Number(rating),
    comment: (comment || '').trim(),
  });

  const allReviews = await Review.find({ product: productId });
  const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
  product.rating = Math.round(avg * 10) / 10;
  product.numReviews = allReviews.length;
  await product.save();

  res.status(201).json({ review, rating: product.rating, numReviews: product.numReviews });
};

// DELETE /api/reviews/:id (owner or admin)
exports.remove = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  if (String(review.user) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to delete this review' });
  }
  const productId = review.product;
  await review.deleteOne();

  const allReviews = await Review.find({ product: productId });
  const avg = allReviews.length ? allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length : 0;
  await Product.findByIdAndUpdate(productId, { rating: Math.round(avg * 10) / 10, numReviews: allReviews.length });

  res.json({ message: 'Review deleted' });
};

// POST /api/reviews/admin  (admin only)
exports.createAdminReview = async (req, res) => {
  const { productId, rating, comment, name } = req.body;
  if (!productId || !rating || !name) {
    return res.status(400).json({ message: 'productId, rating and name are required' });
  }

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const review = await Review.create({
    product: productId,
    user: req.user._id,
    name,
    rating: Number(rating),
    comment: (comment || '').trim(),
  });

  const allReviews = await Review.find({ product: productId });
  const avg = allReviews.length ? allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length : 0;
  await Product.findByIdAndUpdate(productId, { rating: Math.round(avg * 10) / 10, numReviews: allReviews.length });

  res.status(201).json({ review });
};
