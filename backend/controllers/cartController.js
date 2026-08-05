const Cart = require('../models/Cart');

// GET /api/cart
exports.getCart = async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'name price mrp stock images');
  if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });
  res.json({ cart });
};

// POST /api/cart  { productId, qty }
exports.addItem = async (req, res) => {
  const { productId, qty = 1 } = req.body;
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

  const existing = cart.items.find((i) => i.product.toString() === productId);
  if (existing) existing.qty += Number(qty);
  else cart.items.push({ product: productId, qty: Number(qty) });

  await cart.save();
  await cart.populate('items.product', 'name price mrp stock images');
  res.json({ cart });
};

// PUT /api/cart/:productId  { qty }
exports.updateItem = async (req, res) => {
  const { qty } = req.body;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });

  if (qty <= 0) {
    cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
  } else {
    const item = cart.items.find((i) => i.product.toString() === req.params.productId);
    if (item) item.qty = qty;
  }
  await cart.save();
  await cart.populate('items.product', 'name price mrp stock images');
  res.json({ cart });
};

// DELETE /api/cart/:productId
exports.removeItem = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });
  cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
  await cart.save();
  res.json({ cart });
};
