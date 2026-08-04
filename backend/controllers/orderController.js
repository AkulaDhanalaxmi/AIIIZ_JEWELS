const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Setting = require('../models/Setting');

function generateOrderNumber() {
  return 'AIIZ' + Math.floor(100000 + Math.random() * 899999);
}

const DEFAULT_DELIVERY_SETTINGS = {
  storeInfo: {
    name: 'Aiiz Store',
    address: 'Main Store Address',
    pincode: '',
    city: '',
    state: '',
    phone: '',
  },
  shipping: {
    samePIN: 30,
    sameDistrict: 50,
    sameState: 70,
    differentState: 120,
    freeAbove: 999,
  },
  deliveryDays: {
    samePIN: { min: 1, max: 2 },
    sameDistrict: { min: 2, max: 3 },
    sameState: { min: 3, max: 5 },
    differentState: { min: 5, max: 7 },
  },
  deliveryAvailability: {
    nationwide: true,
    blockedPincodes: [],
    blockedStates: [],
  },
};

async function getDeliverySettings() {
  const setting = await Setting.findOne({ key: 'delivery_settings' });
  return setting && setting.value ? setting.value : DEFAULT_DELIVERY_SETTINGS;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isDeliveryAllowed(address, availability) {
  if (!address) return true;
  if (availability?.nationwide !== false) return true;

  const pin = String(address.pincode || '').trim();
  const state = normalizeText(address.state);
  const blockedPincodes = (availability.blockedPincodes || []).map((p) => String(p || '').trim());
  const blockedStates = (availability.blockedStates || []).map((s) => normalizeText(s));

  if (pin && blockedPincodes.includes(pin)) return false;
  if (state && blockedStates.includes(state)) return false;
  return true;
}

function getDeliveryGroup(address, storeInfo) {
  if (!address || !storeInfo) return 'differentState';
  const pin = String(address.pincode || '').trim();
  const city = normalizeText(address.city);
  const state = normalizeText(address.state);
  const storePin = String(storeInfo.pincode || '').trim();
  const storeCity = normalizeText(storeInfo.city);
  const storeState = normalizeText(storeInfo.state);

  if (pin && storePin && pin === storePin) return 'samePIN';
  if (city && storeCity && city === storeCity) return 'sameDistrict';
  if (state && storeState && state === storeState) return 'sameState';
  return 'differentState';
}

function formatDeliveryRange(range) {
  if (!range) return null;
  if (range.min === range.max) return `${range.min} day`;
  return `${range.min}–${range.max} days`;
}

function getShippingInfo(address, subtotal, settings) {
  const deliverySettings = settings || DEFAULT_DELIVERY_SETTINGS;
  const availability = deliverySettings.deliveryAvailability || DEFAULT_DELIVERY_SETTINGS.deliveryAvailability;
  if (!isDeliveryAllowed(address, availability)) {
    return { blocked: true, shipping: 0, range: null, text: 'Delivery not available for this location' };
  }

  const group = getDeliveryGroup(address, deliverySettings.storeInfo);
  const rates = deliverySettings.shipping || DEFAULT_DELIVERY_SETTINGS.shipping;
  const ranges = deliverySettings.deliveryDays || DEFAULT_DELIVERY_SETTINGS.deliveryDays;
  const freeAbove = Number(rates.freeAbove ?? DEFAULT_DELIVERY_SETTINGS.shipping.freeAbove);
  const shipping = subtotal > 0 ? (subtotal >= freeAbove ? 0 : Number(rates[group] ?? rates.differentState)) : 0;
  const range = ranges[group] || ranges.differentState;
  const text = range ? `Estimated delivery ${formatDeliveryRange(range)}` : '';
  return { group, shipping, range, text, blocked: false };
}

async function calcTotals(items, address) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const settings = await getDeliverySettings();
  const shippingInfo = getShippingInfo(address, subtotal, settings);
  if (shippingInfo.blocked) {
    return { subtotal, shipping: 0, tax: Math.round(subtotal * 0.03), total: subtotal + Math.round(subtotal * 0.03), deliveryBlocked: true, deliveryInfo: shippingInfo };
  }
  const shipping = shippingInfo.shipping;
  const tax = Math.round(subtotal * 0.03);
  const total = subtotal + shipping + tax;
  return { subtotal, shipping, tax, total, deliveryInfo: shippingInfo };
}

// POST /api/orders  { items?: [{productId, qty}], address, paymentMethod }
// If `items` is omitted, the order is built from the user's current cart (checkout flow).
exports.placeOrder = async (req, res) => {
  const { items: directItems, address, paymentMethod } = req.body;
  if (!address || !paymentMethod) {
    return res.status(400).json({ message: 'Address and payment method are required' });
  }

  let sourceItems = directItems;
  if (!sourceItems) {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) return res.status(400).json({ message: 'Cart is empty' });
    sourceItems = cart.items.map((i) => ({ productId: i.product._id, qty: i.qty, product: i.product }));
  } else {
    const productIds = sourceItems.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    sourceItems = sourceItems.map((i) => ({
      ...i,
      product: products.find((p) => p._id.toString() === i.productId),
    }));
  }

  const orderItems = sourceItems.map((i) => ({
    product: i.product._id,
    name: i.product.name,
    price: i.product.price,
    qty: i.qty,
  }));
  const totals = await calcTotals(orderItems, address);
  if (totals.deliveryBlocked) {
    return res.status(400).json({ message: 'Delivery is not available for this address' });
  }

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: req.user._id,
    customerName: req.user.name,
    customerEmail: req.user.email,
    items: orderItems,
    address,
    paymentMethod,
    paymentStatus: 'pending',
    ...totals,
    status: 'confirmed',
    statusHistory: [{ status: 'confirmed' }],
  });

  // Decrement stock
  await Promise.all(
    orderItems.map((i) => Product.findByIdAndUpdate(i.product, { $inc: { stock: -i.qty } }))
  );

  // Clear cart if this was a cart-based checkout
  if (!directItems) {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
  }

  res.status(201).json({ order });
};

// GET /api/orders (current user's orders)
exports.myOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ orders });
};

// GET /api/orders/:id
exports.getOne = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to view this order' });
  }
  res.json({ order });
};

// GET /api/orders/admin/all (admin)
exports.allOrders = async (req, res) => {
  const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
  res.json({ orders });
};

// PUT /api/orders/:id/status (admin)  { status }
exports.updateStatus = async (req, res) => {
  const { status, deliveryDate, deliveryState, deliveryNote, paymentStatus, paymentDetails, reviewRequested } = req.body;
  const validStatuses = ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
  const validDeliveryStates = ['scheduled', 'on-time', 'delayed', 'out-of-stock', 'rescheduled'];

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  if (status) {
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    order.status = status;
    order.statusHistory.push({ status });
  }
  if (deliveryDate) {
    order.deliveryDate = new Date(deliveryDate);
  }
  if (deliveryState) {
    if (!validDeliveryStates.includes(deliveryState)) return res.status(400).json({ message: 'Invalid delivery state' });
    order.deliveryState = deliveryState;
  }
  if (typeof deliveryNote === 'string') {
    order.deliveryNote = deliveryNote;
  }
  if (paymentStatus) {
    const validPaymentStatus = ['pending', 'paid', 'failed', 'refunded'];
    if (!validPaymentStatus.includes(paymentStatus)) return res.status(400).json({ message: 'Invalid payment status' });
    order.paymentStatus = paymentStatus;
  }
  if (typeof paymentDetails === 'string') {
    order.paymentDetails = paymentDetails;
  }
  if (typeof reviewRequested === 'boolean') {
    order.reviewRequested = reviewRequested;
  }

  await order.save();
  res.json({ order });
};

// POST /api/orders/:id/cancel  (user)
exports.cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  // only owner can cancel
  if (order.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to cancel this order' });
  }
  // only allow cancelling if not already shipped/delivered/packed
  if (['packed', 'shipped', 'delivered'].includes(order.status)) {
    return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
  }

  order.status = 'cancelled';
  order.statusHistory.push({ status: 'cancelled' });
  await order.save();

  // restore stock
  await Promise.all(order.items.map(i => Product.findByIdAndUpdate(i.product, { $inc: { stock: i.qty } })));

  res.json({ order });
};
