const Category = require('../models/Category');
const Product = require('../models/Product');

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// GET /api/categories
exports.list = async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ categories });
};

// GET /api/categories/:id
exports.getOne = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json({ category });
};

// POST /api/categories (admin)
exports.create = async (req, res) => {
  const { name, icon, image } = req.body;
  if (!name) return res.status(400).json({ message: 'Category name is required' });
  const slug = slugify(name);
  const exists = await Category.findOne({ slug });
  if (exists) return res.status(409).json({ message: 'Category already exists' });
  const category = await Category.create({ name, slug, icon, image });
  res.status(201).json({ category });
};

// PUT /api/categories/:id (admin)
exports.update = async (req, res) => {
  const { name, icon, image } = req.body;
  const update = { icon, image };
  if (name) update.name = name, update.slug = slugify(name);
  const category = await Category.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json({ category });
};

// DELETE /api/categories/:id (admin)
exports.remove = async (req, res) => {
  const inUse = await Product.countDocuments({ category: req.params.id });
  if (inUse > 0) return res.status(400).json({ message: 'Cannot delete a category that has products' });
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json({ message: 'Category deleted' });
};
