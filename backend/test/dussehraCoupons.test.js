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
  const result = validateDussehraCoupon('DUSSEHRA10', [], saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /cart is empty/i);
});

test('rejects DUSSEHRA15 when subtotal is ₹400', () => {
  const result = validateDussehraCoupon('DUSSEHRA15', itemsWithTotal(400, 2), saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /above ₹499/i);
});

test('rejects DUSSEHRA15 at ₹500 with only one item', () => {
  const result = validateDussehraCoupon('DUSSEHRA15', itemsWithTotal(500), saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /at least 2 items/i);
});

test('applies DUSSEHRA15 at ₹500 with two units', () => {
  const result = validateDussehraCoupon('DUSSEHRA15', itemsWithTotal(500, 2), saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 75);
});

test('applies DUSSEHRA20 at ₹500 with three units', () => {
  const result = validateDussehraCoupon('DUSSEHRA20', itemsWithTotal(500, 3), saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 100);
});

test('applies DUSSEHRA10 at ₹1,000 with a ₹100 discount', () => {
  const result = validateDussehraCoupon('DUSSEHRA10', itemsWithTotal(1000), saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 100);
  assert.equal(calculatePayableTotal({ subtotal: 1000, discount: result.discount }), 900);
});

test('ignores client-supplied discount and total values when calculating coupon eligibility', () => {
  const result = validateDussehraCoupon('DUSSEHRA10', [{
    price: 1000,
    qty: 1,
    discount: 9999,
    total: -1,
  }], saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 100);
});

test('DUSSEHRA10 has no minimum subtotal for a non-empty cart', () => {
  const result = validateDussehraCoupon('DUSSEHRA10', [{ price: 0, qty: 1 }], saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.discount, 0);
});

test('rejects coupons for products in the Sale category', () => {
  const result = validateDussehraCoupon('DUSSEHRA10', [{
    price: 1000,
    qty: 1,
    categorySlug: 'sale',
  }], saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /cannot be applied.*Sale category/i);
});

test('applies coupon only to non-Sale products in a mixed cart', () => {
  const result = validateDussehraCoupon('DUSSEHRA10', [
    { price: 1000, qty: 1, categorySlug: 'sale' },
    { price: 500, qty: 1, categorySlug: 'jewellery' },
  ], saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.subtotal, 500);
  assert.equal(result.quantity, 1);
  assert.equal(result.discount, 50);
});

test('coupon minimum subtotal and quantity count only non-Sale products', () => {
  const result = validateDussehraCoupon('DUSSEHRA15', [
    { price: 600, qty: 1, categorySlug: 'sale' },
    { price: 250, qty: 2, categorySlug: 'jewellery' },
  ], saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.subtotal, 500);
  assert.equal(result.quantity, 2);
  assert.equal(result.discount, 75);
});

test('DUSSEHRA15 requires a subtotal strictly greater than ₹499', () => {
  const result = validateDussehraCoupon('DUSSEHRA15', itemsWithTotal(499, 2), saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /above ₹499/i);
});

test('rejects invalid coupon codes', () => {
  const result = validateDussehraCoupon('NOT-A-COUPON', itemsWithTotal(1000), saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /invalid coupon/i);
});

test('rejects coupons before October 5 in India time', () => {
  withSaleStartDate(undefined, () => {
    const result = validateDussehraCoupon('DUSSEHRA10', itemsWithTotal(1000), new Date('2026-10-04T18:29:59.999Z'));
    assert.equal(result.valid, false);
    assert.match(result.message, /October 5 to October 20/i);
  });
});

test('allows coupons starting October 5 in India time', () => {
  withSaleStartDate(undefined, () => {
    const result = validateDussehraCoupon('DUSSEHRA10', itemsWithTotal(1000), new Date('2026-10-04T18:30:00.000Z'));
    assert.equal(result.valid, true);
    assert.equal(result.discount, 100);
  });
});

test('allows coupons from a configured testing start date', () => {
  withSaleStartDate('2026-10-02', () => {
    const result = validateDussehraCoupon('DUSSEHRA10', itemsWithTotal(1000), new Date('2026-10-02T12:00:00+05:30'));
    assert.equal(result.valid, true);
    assert.equal(result.discount, 100);
  });
});

test('rejects coupons after October 20 in India time', () => {
  withSaleStartDate(undefined, () => {
    const result = validateDussehraCoupon('DUSSEHRA10', itemsWithTotal(1000), new Date('2026-10-20T18:30:00.000Z'));
    assert.equal(result.valid, false);
    assert.match(result.message, /October 5 to October 20/i);
  });
});

test('accepts coupons through the end of October 20 in India time', () => {
  const result = validateDussehraCoupon('DUSSEHRA10', itemsWithTotal(1000), new Date('2026-10-20T18:29:59.999Z'));
  assert.equal(result.valid, true);
});

test('allows only one coupon code per order', () => {
  const result = validateDussehraCoupon('DUSSEHRA10 DUSSEHRA15', itemsWithTotal(1000, 2), saleDate);
  assert.equal(result.valid, false);
  assert.match(result.message, /only one/i);
});

test('counts actual unit quantity when a single cart line has multiple units', () => {
  const result = validateDussehraCoupon('DUSSEHRA15', [{ price: 250, qty: 2 }], saleDate);
  assert.equal(result.valid, true);
  assert.equal(result.quantity, 2);
});

test('server-derived discount and payable amount match the payment amount in paise', () => {
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
  const totals = validateStoredOrderTotals(order);
  assert.equal(totals.valid, true);
  assert.equal(totals.expectedTotal, 920);
  assert.equal(totals.expectedAmountInSmallestUnit, 92000);
  assert.equal(calculatePayableTotal({ subtotal: 1000, discount: 1200 }), 0);
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
    couponCode: 'DUSSEHRA10',
    discount: 0,
    shipping: 20,
    giftWrapCost: 0,
    total: 1020,
    createdAt: saleDate,
  };
  assert.equal(validateStoredOrderTotals(order).valid, false);
});
