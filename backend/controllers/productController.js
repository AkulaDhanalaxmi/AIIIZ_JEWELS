const mongoose = require('mongoose');
const Product = require('../models/Product');

// GET /api/products?category=rings&search=ring&minPrice=1000&maxPrice=50000&page=1&limit=20
exports.list = async (req, res) => {
  console.log('[Product API] request reached /api/products', {
    method: req.method,
    query: req.query,
    mongooseReadyState: mongoose.connection.readyState,
  });
  const { category, search, minPrice, maxPrice, featured, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (featured) filter.isFeatured = featured === 'true';
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);

  // Only return the fields needed for the product listing page.
  // This avoids sending the full images array and other large fields.
  console.time('Product.find');
  const products = await Product.find(filter)
    .select('name category price mrp material occasion weight description images stock rating numReviews')
    .slice('images', 1)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();
  console.timeEnd('Product.find');

  console.time('Product.countDocuments');
  const total = await Product.countDocuments(filter);
  console.timeEnd('Product.countDocuments');

  console.log('[Product API] query result', {
    productsReturned: products.length,
    totalDocuments: total,
    page: Number(page),
    limit: Number(limit),
    filter,
  });

  res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// GET /api/products/:id
exports.getOne = async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name slug').lean();
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({ product });
};

// POST /api/products (admin)
exports.create = async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ product });
};

// PUT /api/products/:id (admin)
exports.update = async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({ product });
};

// DELETE /api/products/:id (admin)
exports.remove = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({ message: 'Product deleted' });
};
