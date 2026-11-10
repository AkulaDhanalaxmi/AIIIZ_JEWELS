function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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

  const discount = Number(order.discount || 0);
  const shipping = Number(order.shipping || 0);
  const giftWrapCost = Number(order.giftWrapCost || 0);
  if (
    !Number.isFinite(discount) || discount < 0 || discount > subtotal ||
    !Number.isFinite(shipping) || shipping < 0 ||
    !Number.isFinite(giftWrapCost) || giftWrapCost < 0
  ) {
    return { valid: false, message: 'Order totals are invalid.' };
  }

  const expectedTotal = calculatePayableTotal({ subtotal, discount, shipping, giftWrapCost });
  const totalsMatch =
    Math.abs(Number(order.subtotal) - subtotal) < 0.01 &&
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
  validateStoredOrderTotals,
};
