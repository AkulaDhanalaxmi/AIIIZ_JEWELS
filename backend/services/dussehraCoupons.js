const OFFERS = Object.freeze({
  DUSSEHRA10: { percent: 10, minQty: 0, minSubtotal: 0 },
  DUSSEHRA15: { percent: 15, minQty: 0, minSubtotal: 499 },
  DUSSEHRA20: { percent: 20, minQty: 0, minSubtotal: 999 },
});

const DEFAULT_SALE_START_DATE = '2026-10-05';
const SALE_END_DATE = '2026-10-20';

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getSaleStartDate() {
  const configuredDate = process.env.DUSSEHRA_COUPON_START_DATE;
  if (!configuredDate) return DEFAULT_SALE_START_DATE;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(configuredDate)) {
    throw new Error('DUSSEHRA_COUPON_START_DATE must use YYYY-MM-DD format.');
  }

  const parsedDate = new Date(`${configuredDate}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== configuredDate ||
    configuredDate > SALE_END_DATE
  ) {
    throw new Error('DUSSEHRA_COUPON_START_DATE must be a valid date on or before 2026-10-20.');
  }

  return configuredDate;
}

function indiaDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateDussehraCoupon(couponCode, items, now = new Date()) {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, message: 'Your cart is empty.' };
  }

  if (typeof couponCode !== 'string' || !couponCode.trim()) {
    return { valid: false, message: 'Enter a coupon code.' };
  }

  const code = couponCode.trim().toUpperCase();
  const matchingCodes = code.match(/DUSSEHRA(?:10|15|20)/g) || [];
  if (matchingCodes.length > 1) {
    return { valid: false, message: 'Only one Dussehra coupon can be applied per order.' };
  }

  const offer = OFFERS[code];
  if (!offer) {
    return { valid: false, message: 'Invalid coupon code.' };
  }

  const today = indiaDateKey(now);
  const saleStartDate = getSaleStartDate();
  if (today < saleStartDate || today > SALE_END_DATE) {
    const startLabel = saleStartDate === DEFAULT_SALE_START_DATE
      ? 'October 5'
      : new Date(`${saleStartDate}T00:00:00.000Z`).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      });
    return {
      valid: false,
      message: `Dussehra coupons are valid from ${startLabel} to October 20, 2026 (IST).`,
    };
  }

  let subtotal = 0;
  let quantity = 0;
  for (const item of items) {
    const price = Number(item.price);
    const qty = Number(item.qty);
    if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(qty) || qty < 1) {
      return { valid: false, message: 'Cart items are invalid. Please refresh your cart and try again.' };
    }
    if (String(item.categorySlug || '').trim().toLowerCase() === 'sale') continue;
    subtotal += price * qty;
    quantity += qty;
  }
  subtotal = roundMoney(subtotal);

  if (quantity === 0) {
    return { valid: false, message: 'Coupons cannot be applied to products in the Sale category.' };
  }

  if (offer.minSubtotal > 0 && subtotal < offer.minSubtotal) {
    return { valid: false, message: `${code} requires a cart subtotal of at least ₹${offer.minSubtotal}.` };
  }
  if (offer.minQty > 0 && quantity < offer.minQty) {
    return { valid: false, message: `${code} requires at least ${offer.minQty} items. Your cart has ${quantity}.` };
  }

  const discount = Math.min(subtotal, roundMoney(subtotal * offer.percent / 100));
  return {
    valid: true,
    code,
    percent: offer.percent,
    subtotal,
    quantity,
    discount,
  };
}

function calculatePayableTotal({ subtotal, discount = 0, shipping = 0, giftWrapCost = 0 }) {
  return Math.max(0, roundMoney(
    Number(subtotal) - Number(discount) + Number(shipping) + Number(giftWrapCost)
  ));
}

function validateStoredOrderTotals(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = roundMoney(items.reduce((sum, item) => {
    const price = Number(item.price);
    const qty = Number(item.qty);
    if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(qty) || qty < 1) {
      return NaN;
    }
    return sum + price * qty;
  }, 0));
  if (!Number.isFinite(subtotal) || items.length === 0) {
    return { valid: false, message: 'Order items are invalid.' };
  }

  let discount = 0;
  if (order.couponCode) {
    const coupon = validateDussehraCoupon(order.couponCode, items, order.createdAt || new Date());
    if (!coupon.valid) return { valid: false, message: 'The saved order coupon is invalid.' };
    discount = coupon.discount;
  }

  const expectedTotal = calculatePayableTotal({
    subtotal,
    discount,
    shipping: order.shipping,
    giftWrapCost: order.giftWrapCost,
  });
  const totalsMatch =
    Math.abs(Number(order.subtotal) - subtotal) < 0.01 &&
    Math.abs(Number(order.discount || 0) - discount) < 0.01 &&
    Math.abs(Number(order.total) - expectedTotal) < 0.01;

  return {
    valid: totalsMatch,
    message: totalsMatch ? undefined : 'Order totals do not match the server-calculated amount.',
    subtotal,
    discount,
    expectedTotal,
    expectedAmountInSmallestUnit: Math.round(expectedTotal * 100),
  };
}

module.exports = {
  calculatePayableTotal,
  roundMoney,
  validateDussehraCoupon,
  validateStoredOrderTotals,
};
