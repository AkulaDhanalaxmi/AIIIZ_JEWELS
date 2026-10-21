const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculatePayableTotal,
  validateDussehraCoupon,
  validateStoredOrderTotals,
} = require('../services/dussehraCoupons');

const saleDate = new Date('2026-10-10T12:00:00+05:30');

function itemsWithTotal(total, qty = 1) {
  return [{ price: total / qty, qty }];
}

function withSaleStartDate(startDate, callback) {
  const previousStartDate = process.env.DUSSEHRA_COUPON_START_DATE;
  if (startDate) process.env.DUSSEHRA_COUPON_START_DATE = startDate;
  else delete process.env.DUSSEHRA_COUPON_START_DATE;

  try {
    callback();
  } finally {
    if (previousStartDate === undefined) delete process.env.DUSSEHRA_COUPON_START_DATE;
    else process.env.DUSSEHRA_COUPON_START_DATE = previousStartDate;
  }
}

test('rejects an empty cart', () => {
  const result = validateDussehraCoupon('DIWALI10', [], saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /cart is empty/i);
});

test('rejects DIWALI15 when subtotal is below ₹499', () => {
  const result = validateDussehraCoupon('DIWALI15', itemsWithTotal(498), saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /at least ₹499/i);
});

test('applies DIWALI15 at ₹499 with a single item', () => {
  const result = validateDussehraCoupon('DIWALI15', itemsWithTotal(499), saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 74.85);
});

test('applies DIWALI15 at ₹500 with one item', () => {
  const result = validateDussehraCoupon('DIWALI15', itemsWithTotal(500), saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 75);
});

test('rejects DIWALI20 when subtotal is below ₹999', () => {
  const result = validateDussehraCoupon('DIWALI20', itemsWithTotal(998), saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /at least ₹999/i);
});

test('applies DIWALI20 at ₹999 with a single item', () => {
  const result = validateDussehraCoupon('DIWALI20', itemsWithTotal(999), saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 199.8);
});

test('applies DIWALI10 at ₹1,000 with a ₹100 discount', () => {
  const result = validateDussehraCoupon('DIWALI10', itemsWithTotal(1000), saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 100);
  assert.equal(calculatePayableTotal({ subtotal: 1000, discount: result.discount }), 900);
});

test('ignores client-supplied discount and total values when calculating coupon eligibility', () => {
  const result = validateDussehraCoupon('DIWALI10', [{
    price: 1000,
    qty: 1,
    discount: 9999,
    total: -1,
  }], saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 100);
});

test('DIWALI10 has no minimum subtotal for a non-empty cart', () => {
  const result = validateDussehraCoupon('DIWALI10', [{ price: 0, qty: 1 }], saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 0);
});

test('rejects coupons for products in the Sale category', () => {
  const result = validateDussehraCoupon('DIWALI10', [{
    price: 1000,
    qty: 1,
    categorySlug: 'sale',
  }], saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /cannot be applied.*Sale category/i);
});

test('applies coupon only to non-Sale products in a mixed cart', () => {
  const result = validateDussehraCoupon('DIWALI10', [
    { price: 1000, qty: 1, categorySlug: 'sale' },
    { price: 500, qty: 1, categorySlug: 'jewellery' },
  ], saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.subtotal, 500);
  assert.equal(result.quantity, 1);
  assert.equal(result.discount, 50);
});

test('coupon minimum subtotal and quantity count only non-Sale products', () => {
  const result = validateDussehraCoupon('DIWALI15', [
    { price: 600, qty: 1, categorySlug: 'sale' },
    { price: 250, qty: 2, categorySlug: 'jewellery' },
  ], saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.subtotal, 500);
  assert.equal(result.quantity, 2);
  assert.equal(result.discount, 75);
});

test('DIWALI15 accepts a subtotal of exactly ₹499', () => {
  const result = validateDussehraCoupon('DIWALI15', itemsWithTotal(499, 1), saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 74.85);
});

test('rejects invalid coupon codes', () => {
  const result = validateDussehraCoupon('NOT-A-COUPON', itemsWithTotal(1000), saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /invalid coupon/i);
});

test('rejects retired Dussehra codes for new coupons', () => {
  const result = validateDussehraCoupon('DUSSEHRA10', itemsWithTotal(1000), saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /invalid coupon/i);
});

test('rejects coupons before October 5 in India time', () => {
  withSaleStartDate(undefined, () => {
    const result = validateDussehraCoupon('DIWALI10', itemsWithTotal(1000), new Date('2026-10-04T18:29:59.999Z'));
    assert.equal(result.valid, false);
    assert.match(result.message, /Diwali coupons are valid from October 5 to November 8/i);
  });
});

test('allows coupons starting October 5 in India time', () => {
  withSaleStartDate(undefined, () => {
    const result = validateDussehraCoupon('DIWALI10', itemsWithTotal(1000), new Date('2026-10-04T18:30:00.000Z'));
    assert.equal(result.valid, true);
    assert.equal(result.discount, 100);
  });
});

test('allows coupons from a configured testing start date', () => {
  withSaleStartDate('2026-10-02', () => {
    const result = validateDussehraCoupon('DIWALI10', itemsWithTotal(1000), new Date('2026-10-02T12:00:00+05:30'));
    assert.equal(result.valid, true);
    assert.equal(result.discount, 100);
  });
});

test('rejects coupons after November 8 in India time', () => {
  withSaleStartDate(undefined, () => {
    const result = validateDussehraCoupon('DIWALI10', itemsWithTotal(1000), new Date('2026-11-08T18:30:00.000Z'));
    assert.equal(result.valid, false);
    assert.match(result.message, /Diwali coupons are valid from October 5 to November 8/i);
  });
});

test('accepts every Diwali coupon through the end of November 8 in India time', () => {
  for (const code of ['DIWALI10', 'DIWALI15', 'DIWALI20']) {
    const result = validateDussehraCoupon(code, itemsWithTotal(1000), new Date('2026-11-08T18:29:59.999Z'));
    assert.equal(result.valid, true, `${code} should be valid through November 8 in India time`);
  }
});

test('rejects every Diwali coupon immediately after the November 8 expiry', () => {
  for (const code of ['DIWALI10', 'DIWALI15', 'DIWALI20']) {
    const result = validateDussehraCoupon(code, itemsWithTotal(1000), new Date('2026-11-08T18:30:00.000Z'));
    assert.equal(result.valid, false, `${code} should expire after November 8 in India time`);
    assert.match(result.message, /Diwali coupons are valid from October 5 to November 8/i);
  }
});

test('allows only one coupon code per order', () => {
  const result = validateDussehraCoupon('DIWALI10 DIWALI15', itemsWithTotal(1000, 2), saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /only one/i);
});

test('counts actual unit quantity when a single cart line has multiple units', () => {
  const result = validateDussehraCoupon('DIWALI15', [{ price: 250, qty: 2 }], saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.quantity, 2);
});

test('server-derived discount and payable amount match the payment amount in paise', () => {
  const order = {
    items: [{ price: 1000, qty: 1 }],
    subtotal: 1000,
    couponCode: 'DIWALI10',
    discount: 100,
    shipping: 20,
    giftWrapCost: 0,
    total: 920,
    createdAt: saleDate,
  };
  const totals = validateStoredOrderTotals(order);
  assert.equal(totals.valid, true);
  assert.equal(totals.expectedTotal, 920);
  assert.equal(totals.expectedAmountInSmallestUnit, 92000);
  assert.equal(calculatePayableTotal({ subtotal: 1000, discount: 1200 }), 0);
});

test('validates historical orders saved with a Dussehra code', () => {
  const order = {
    items: [{ price: 1000, qty: 1 }],
    subtotal: 1000,
    couponCode: 'DUSSEHRA10',
    discount: 100,
    shipping: 20,
    giftWrapCost: 0,
    total: 920,
    createdAt: saleDate,
  };
  assert.equal(validateStoredOrderTotals(order).valid, true);
});

test('rejects stored order totals when its coupon includes a Sale category item', () => {
  const order = {
    items: [{ price: 1000, qty: 1, categorySlug: 'sale' }],
    subtotal: 1000,
    couponCode: 'DUSSEHRA10',
    discount: 100,
    shipping: 20,
    giftWrapCost: 0,
    total: 920,
    createdAt: saleDate,
  };
  assert.equal(validateStoredOrderTotals(order).valid, false);
});

test('rejects stored order totals changed from the server calculation', () => {
  const order = {
    items: [{ price: 1000, qty: 1 }],
    subtotal: 1000,
    couponCode: 'DIWALI10',
    discount: 0,
    shipping: 20,
    giftWrapCost: 0,
    total: 1020,
    createdAt: saleDate,
  };
  assert.equal(validateStoredOrderTotals(order).valid, false);
});
