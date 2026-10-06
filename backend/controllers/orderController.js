const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Setting = require('../models/Setting');
const { calculatePayableTotal, roundMoney, validateDussehraCoupon } = require('../services/dussehraCoupons');
const { validateMehendiBooking } = require('../services/mehendiBooking');

function generateOrderNumber() {
  return 'AIIZ' + Math.floor(100000 + Math.random() * 899999);
}

const DEFAULT_DELIVERY_SETTINGS = {
  storeInfo: {
    name: 'Aiiz Store',
    address: '5-1-119 Kumpalli, Bokkalgadda, Hanumakonda',
    pincode: '',
    city: 'Hanumakonda',
    district: 'Hanumakonda',
    state: 'Telangana',
    phone: '8880001886',
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
  const value = setting && setting.value ? setting.value : {};
  const storeInfo = Object.assign({}, DEFAULT_DELIVERY_SETTINGS.storeInfo, value.storeInfo || {});
  ['address', 'city', 'state'].forEach((key) => {
    if (!normalizeText(storeInfo[key])) {
      storeInfo[key] = DEFAULT_DELIVERY_SETTINGS.storeInfo[key];
    }
  });
  return {
    storeInfo,
    shipping: Object.assign({}, DEFAULT_DELIVERY_SETTINGS.shipping, value.shipping || {}),
    deliveryDays: Object.assign({}, DEFAULT_DELIVERY_SETTINGS.deliveryDays, value.deliveryDays || {}),
    deliveryAvailability: Object.assign(
      {},
      DEFAULT_DELIVERY_SETTINGS.deliveryAvailability,
      value.deliveryAvailability || {}
    ),
  };
}

function normalizeText(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'hanamkonda' ? 'hanumakonda' : normalized;
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

function orderPricingBreakdown(items, totals, discount, couponCode) {
  return {
    items: items.map((item) => ({
      productId: String(item.product),
      price: Number(item.price),
      qty: Number(item.qty),
    })),
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    discount,
    couponCode: couponCode || null,
    giftWrapCost: totals.giftWrapCost,
    total: totals.total,
  };
}

function compareOrderPricing(expected, actual) {
  if (!expected || typeof expected !== 'object') return [];
  const mismatches = [];
  ['subtotal', 'shipping', 'discount', 'giftWrapCost', 'total'].forEach((field) => {
    const expectedValue = Number(expected[field]);
    const actualValue = Number(actual[field]);
    if (!Number.isFinite(expectedValue) || Math.abs(expectedValue - actualValue) >= 0.01) {
      mismatches.push({ field, expected: expected[field] ?? null, actual: actualValue });
    }
  });

  if (String(expected.couponCode || '').trim().toUpperCase() !==
      String(actual.couponCode || '').trim().toUpperCase()) {
    mismatches.push({ field: 'couponCode', expected: expected.couponCode || null, actual: actual.couponCode });
  }

  const itemSignature = (items) => (Array.isArray(items) ? items : [])
    .map((item) => `${String(item.productId || '').toLowerCase()}:${Number(item.price)}:${Number(item.qty)}`)
    .sort()
    .join('|');
  if (itemSignature(expected.items) !== itemSignature(actual.items)) {
    mismatches.push({ field: 'items', expected: expected.items || [], actual: actual.items });
  }
  return mismatches;
}

async function calcTotals(items, address, giftWrap = false) {
  const subtotal = roundMoney(items.reduce((sum, i) => sum + i.price * i.qty, 0));
  const settings = await getDeliverySettings();
  const shippingInfo = getShippingInfo(address, subtotal, settings);
  const giftWrapCost = giftWrap ? 30 : 0;
  if (shippingInfo.blocked) {
    return { subtotal, shipping: 0, giftWrapCost, total: subtotal + giftWrapCost, deliveryBlocked: true, deliveryInfo: shippingInfo };
  }
  const shipping = shippingInfo.shipping;
  const total = calculatePayableTotal({ subtotal, shipping, giftWrapCost });
  return { subtotal, shipping, giftWrapCost, total, deliveryInfo: shippingInfo };
}

async function resolveOrderItems(requestItems) {
  if (!Array.isArray(requestItems) || requestItems.length === 0) {
    return { error: 'Cart is empty.' };
  }

  for (const item of requestItems) {
    if (!item || !/^[a-f\d]{24}$/i.test(String(item.productId || '')) ||
        !Number.isSafeInteger(Number(item.qty)) || Number(item.qty) < 1) {
      return { error: 'Cart items are invalid. Please refresh your cart and try again.' };
    }
  }

  const productIds = requestItems.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('name price stock category')
    .populate('category', 'name slug');
  const productById = new Map(products.map((product) => [product._id.toString().toLowerCase(), product]));
  const items = requestItems.map((item) => {
    const product = productById.get(String(item.productId).toLowerCase());
    if (!product || !Number.isFinite(Number(product.price)) || Number(product.price) < 0) return null;
    return {
      product: product._id,
      name: product.name,
      price: Number(product.price),
      qty: Number(item.qty),
      categorySlug: [product.category?.slug, product.category?.name]
        .some((value) => String(value || '').trim().toLowerCase() === 'sale')
        ? 'sale'
        : String(product.category?.slug || '').trim().toLowerCase(),
    };
  });
  if (items.some((item) => !item)) {
    return { error: 'A product in your cart is no longer available. Please refresh your cart.' };
  }
  return { items };
}

exports.validateCoupon = async (req, res, next) => {
  try {
    const { couponCode, items } = req.body;
    const resolved = await resolveOrderItems(items);
    if (resolved.error) return res.status(400).json({ valid: false, message: resolved.error });

    const result = validateDussehraCoupon(couponCode, resolved.items);
    if (!result.valid) return res.status(400).json({ valid: false, message: result.message });
    return res.json({
      valid: true,
      coupon: { code: result.code, percent: result.percent, discount: result.discount },
      subtotal: result.subtotal,
      quantity: result.quantity,
    });
  } catch (error) {
    next(error);
  }
};

exports.quoteOrder = async (req, res, next) => {
  try {
    const { items: requestedItems, address, giftWrap, couponCode } = req.body;
    if (!address) return res.status(400).json({ message: 'Delivery address is required.' });

    const resolved = await resolveOrderItems(requestedItems);
    if (resolved.error) return res.status(400).json({ message: resolved.error });

    let coupon = null;
    if (couponCode) {
      coupon = validateDussehraCoupon(couponCode, resolved.items);
      if (!coupon.valid) return res.status(400).json({ message: coupon.message });
    }

    const totals = await calcTotals(resolved.items, address, !!giftWrap);
    if (totals.deliveryBlocked) {
      return res.status(400).json({ message: 'Delivery is not available for this address.' });
    }
    const discount = coupon ? coupon.discount : 0;
    const total = calculatePayableTotal({
      subtotal: totals.subtotal,
      discount,
      shipping: totals.shipping,
      giftWrapCost: totals.giftWrapCost,
    });

    return res.json({
      items: resolved.items.map((item) => ({
        productId: String(item.product),
        price: item.price,
        qty: item.qty,
      })),
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      discount,
      couponCode: coupon ? coupon.code : null,
      giftWrapCost: totals.giftWrapCost,
      total,
      deliveryInfo: totals.deliveryInfo,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/orders  { items?: [{productId, qty}], address, paymentMethod }
// If `items` is omitted, the order is built from the user's current cart (checkout flow).
exports.placeOrder = async (req, res, next) => {
  console.time('placeOrder:overall');
  try {
    const {
      items: directItems,
      address,
      paymentMethod,
      giftWrap,
      giftMessage,
      couponCode,
      mehendiBooking: requestedMehendiBooking,
      expectedTotal,
      expectedQuote,
    } = req.body;
    if (!address || !paymentMethod) {
      return res.status(400).json({ message: 'Address and payment method are required' });
    }

    let requestedItems = directItems;
    if (directItems === undefined) {
      console.time('placeOrder:load-cart');
      const cart = await Cart.findOne({ user: req.user._id }).lean();
      console.timeEnd('placeOrder:load-cart');
      if (!cart || cart.items.length === 0) return res.status(400).json({ message: 'Cart is empty' });
      requestedItems = cart.items.map((item) => ({ productId: String(item.product), qty: item.qty }));
    }

    const resolved = await resolveOrderItems(requestedItems);
    if (resolved.error) return res.status(400).json({ message: resolved.error });
    const orderItems = resolved.items;

    const mehendiResult = validateMehendiBooking(requestedMehendiBooking);
    if (!mehendiResult.valid) {
      return res.status(400).json({ message: mehendiResult.message });
    }

    let coupon = null;
    if (couponCode != null && couponCode !== '') {
      coupon = validateDussehraCoupon(couponCode, orderItems);
      if (!coupon.valid) return res.status(400).json({ message: coupon.message });
    }

    console.time('placeOrder:calc-totals');
    const totals = await calcTotals(orderItems, address, !!giftWrap);
    console.timeEnd('placeOrder:calc-totals');
    if (totals.deliveryBlocked) {
      return res.status(400).json({ message: 'Delivery is not available for this address' });
    }
    const discount = coupon ? coupon.discount : 0;
    totals.total = calculatePayableTotal({
      subtotal: totals.subtotal,
      discount,
      shipping: totals.shipping,
      giftWrapCost: totals.giftWrapCost,
    });
    const actualQuote = orderPricingBreakdown(
      orderItems,
      totals,
      discount,
      coupon ? coupon.code : null
    );
    const quoteMismatches = compareOrderPricing(expectedQuote, actualQuote);
    const expectedTotalMismatch = expectedTotal !== undefined &&
      (!Number.isFinite(Number(expectedTotal)) ||
        Math.abs(roundMoney(expectedTotal) - totals.total) >= 0.01);
    if (expectedTotalMismatch || quoteMismatches.length > 0) {
      if (expectedTotalMismatch && !quoteMismatches.some((mismatch) => mismatch.field === 'total')) {
        quoteMismatches.push({
          field: 'total',
          expected: Number.isFinite(Number(expectedTotal)) ? roundMoney(expectedTotal) : expectedTotal,
          actual: totals.total,
        });
      }
      console.warn('Order quote changed before order creation', {
        userId: String(req.user._id),
        mismatches: quoteMismatches,
      });
      return res.status(409).json({
        message: 'The order price changed before submission. Review the updated breakdown and place your order again.',
        mismatches: quoteMismatches,
        quote: Object.assign({}, actualQuote, { deliveryInfo: totals.deliveryInfo }),
      });
    }

    console.time('placeOrder:create-order');
    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      user: req.user._id,
      customerName: req.user.name,
      customerEmail: req.user.email,
      items: orderItems,
      address,
      paymentMethod,
      paymentStatus: 'pending',
      giftWrap: !!giftWrap,
      giftMessage: giftMessage ? String(giftMessage).trim() : '',
      giftWrapCost: totals.giftWrapCost,
      mehendiBooking: mehendiResult.booking,
      couponCode: coupon ? coupon.code : null,
      discount,
      ...totals,
      status: 'confirmed',
      statusHistory: [{ status: 'confirmed' }],
    });
    console.timeEnd('placeOrder:create-order');

    console.time('placeOrder:decrement-stock');
    await Promise.all(
      orderItems.map((i) => Product.findByIdAndUpdate(i.product, { $inc: { stock: -i.qty } }))
    );
    console.timeEnd('placeOrder:decrement-stock');

    if (directItems === undefined) {
      console.time('placeOrder:clear-cart');
      await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
      console.timeEnd('placeOrder:clear-cart');
    }

    res.status(201).json({ order });
  } catch (error) {
    next(error);
  } finally {
    console.timeEnd('placeOrder:overall');
  }
};

// GET /api/orders (current user's orders)
exports.myOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ orders });
};

// GET /api/orders/:id
exports.getOne = async (req, res) => {
  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to view this order' });
  }
  res.json({ order });
};

// GET /api/orders/admin/all (admin)
exports.allOrders = async (req, res) => {
  const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 }).lean();
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
