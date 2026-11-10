const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculatePayableTotal,
  roundMoney,
  validateStoredOrderTotals,
} = require('../services/orderTotals');

test('rounds monetary values to two decimal places', () => {
  assert.equal(roundMoney(12.345), 12.35);
});

test('calculates new order totals without discounts', () => {
  assert.equal(calculatePayableTotal({
    subtotal: 1000,
    shipping: 70,
    giftWrapCost: 30,
  }), 1100);
});

test('continues validating historical orders with recorded discounts', () => {
  const result = validateStoredOrderTotals({
    items: [{ price: 1000, qty: 1 }],
    subtotal: 1000,
    discount: 100,
    shipping: 20,
    giftWrapCost: 0,
    total: 920,
  });

  assert.equal(result.valid, true);
  assert.equal(result.discount, 100);
  assert.equal(result.expectedTotal, 920);
  assert.equal(result.expectedAmountInSmallestUnit, 92000);
});

test('rejects stored orders whose recorded total does not match their breakdown', () => {
  const result = validateStoredOrderTotals({
    items: [{ price: 1000, qty: 1 }],
    subtotal: 1000,
    discount: 100,
    shipping: 20,
    giftWrapCost: 0,
    total: 1020,
  });

  assert.equal(result.valid, false);
});

test('rejects invalid stored order items and discounts', () => {
  assert.equal(validateStoredOrderTotals({
    items: [{ price: 1000, qty: 0 }],
    subtotal: 1000,
    discount: 0,
    shipping: 20,
    total: 1020,
  }).valid, false);

  assert.equal(validateStoredOrderTotals({
    items: [{ price: 1000, qty: 1 }],
    subtotal: 1000,
    discount: 1001,
    shipping: 20,
    total: 19,
  }).valid, false);
});
