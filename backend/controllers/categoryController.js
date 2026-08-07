const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// GET /api/categories
exports.list = async (req, res) => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  res.json({ categories });
};

// GET /api/categories/:id
exports.getOne = async (req, res) => {
  const category = await Category.findById(req.params.id).lean();
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json({ category });
};

// POST /api/categories (admin)
exports.create = async (req, res) => {
  const { name, icon, image, parent } = req.body;
  console.log('PARENT FROM BODY:', parent);
  if (!name) return res.status(400).json({ message: 'Category name is required' });
  if (parent && !mongoose.isValidObjectId(parent)) {
    return res.status(400).json({ message: 'Invalid parent category' });
  }
  if (parent) {
    const parentCategory = await Category.findById(parent);
    if (!parentCategory) return res.status(400).json({ message: 'Parent category not found' });
  }
  const slug = slugify(name);
  const exists = await Category.findOne({ slug, parent: parent || null });
  if (exists) return res.status(409).json({ message: 'Category already exists under this parent' });
  const category = await Category.create({ name, slug, icon, image, parent: parent || null });
  console.log('SAVED CATEGORY:', category);
  res.status(201).json({ category });
};

// PUT /api/categories/:id (admin)
exports.update = async (req, res) => {
  const { name, icon, image, parent } = req.body;
  if (parent && !mongoose.isValidObjectId(parent)) {
    return res.status(400).json({ message: 'Invalid parent category' });
  }
  if (parent && parent === req.params.id) {
    return res.status(400).json({ message: 'A category cannot be its own parent' });
  }
  if (parent) {
    const parentCategory = await Category.findById(parent);
    if (!parentCategory) return res.status(400).json({ message: 'Parent category not found' });
  }
  const update = { icon, image, parent: parent || null };
  if (name) {
    update.name = name;
    update.slug = slugify(name);
  }

  if (name || typeof parent !== 'undefined') {
    const slug = update.slug || slugify(name || (await Category.findById(req.params.id)).name);
    const checkParent = typeof parent !== 'undefined' ? parent || null : (await Category.findById(req.params.id)).parent || null;
    const conflict = await Category.findOne({
      slug,
      parent: checkParent,
      _id: { $ne: req.params.id },
    });
    if (conflict) return res.status(409).json({ message: 'Category already exists under this parent' });
  }

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
