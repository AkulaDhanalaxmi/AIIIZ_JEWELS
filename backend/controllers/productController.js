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
    .select('name category price mrp material finish size stoneType color style occasion packageIncludes care weight description images stock rating numReviews')
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
  console.log('[Product API] create req.body', req.body);
  const stock = req.body.stock != null ? Number(req.body.stock) : 0;
  if (Number.isNaN(stock) || stock < 0) return res.status(400).json({ message: 'Invalid stock value' });
  const size = req.body.size != null ? String(req.body.size).trim() : '';
  const createBody = {
    ...req.body,
    stock,
    size,
  };
  console.log('[Product API] create body', createBody);
  const product = await Product.create(createBody);
  console.log('[Product API] created product', product);
  res.status(201).json({ product });
};

// PUT /api/products/:id (admin)
exports.update = async (req, res) => {
  console.log('[Product API] update req.body', req.body);
  const updateBody = { ...req.body };
  if (updateBody.stock != null) {
    const stock = Number(updateBody.stock);
    if (Number.isNaN(stock) || stock < 0) return res.status(400).json({ message: 'Invalid stock value' });
    updateBody.stock = stock;
  }
  if (req.body.size != null) {
    updateBody.size = String(req.body.size).trim();
  }
  console.log('[Product API] update body', updateBody);
  const product = await Product.findByIdAndUpdate(req.params.id, updateBody, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  const verify = await Product.findById(product._id);
  console.log('Updated product size:', product.size);
  console.log('Full updated product:', product);
  console.log('[Product API] verify product after update', verify);
  console.log('[Product API] verify size after update', verify?.size);
  console.log('[Product API] updated product', product);
  res.json({ product });
};

// DELETE /api/products/:id (admin)
exports.remove = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({ message: 'Product deleted' });
};
