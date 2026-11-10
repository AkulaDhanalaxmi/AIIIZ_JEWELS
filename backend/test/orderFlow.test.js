const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../models/Order');
const Product = require('../models/Product');
const ProductSetting = require('../models/Setting');
const orderController = require('../controllers/orderController');

const USER_ID = '64a000000000000000000001';
const PRODUCT_ID = '64a000000000000000000002';
const deliverySettings = {
  storeInfo: {
    pincode: '506001',
    city: 'Hanumakonda',
    state: 'Telangana',
  },
  shipping: {
    samePIN: 30,
    sameDistrict: 50,
    sameState: 70,
    differentState: 100,
    freeAbove: 1599,
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

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function withOrderMocks(t, { price = 858, category = { name: 'Jewellery', slug: 'jewellery' }, settings = deliverySettings } = {}) {
  const originals = {
    productFind: Product.find,
    productFindByIdAndUpdate: Product.findByIdAndUpdate,
    settingFindOne: ProductSetting.findOne,
    orderCreate: Order.create,
  };
  const createdOrders = [];
  const product = {
    _id: PRODUCT_ID,
    name: 'Test jewellery item',
    price,
    stock: 10,
    category,
  };
  Product.find = () => ({
    select() { return this; },
    populate() { return Promise.resolve([product]); },
  });
  Product.findByIdAndUpdate = async () => product;
  ProductSetting.findOne = async () => ({ value: settings });
  Order.create = async (data) => {
    createdOrders.push(data);
    return { ...data, _id: '64a000000000000000000003', createdAt: new Date('2026-10-05T12:00:00Z') };
  };
  t.after(() => {
    Product.find = originals.productFind;
    Product.findByIdAndUpdate = originals.productFindByIdAndUpdate;
    ProductSetting.findOne = originals.settingFindOne;
    Order.create = originals.orderCreate;
  });
  return { createdOrders };
}

function request(body) {
  return {
    body,
    user: {
      _id: USER_ID,
      name: 'Test customer',
      email: 'test@example.com',
    },
  };
}

function checkoutBody(overrides = {}) {
  return {
    items: [{ productId: PRODUCT_ID, qty: 1 }],
    address: {
      name: 'Test customer',
      phone: '9000000000',
      line: 'Hyderabad',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
    },
    paymentMethod: 'cod',
    giftWrap: false,
    ...overrides,
  };
}

test('order creation ignores retired mehendi booking submissions', async (t) => {
  const { createdOrders } = withOrderMocks(t, { price: 858 });
  const res = mockResponse();
  await orderController.placeOrder(request(checkoutBody({
    mehendiBooking: {
      address: '12 Temple Street, near the park',
      pincode: '506001',
      date: '2026-10-20',
      timeSlot: '4:00 PM – 6:00 PM',
    },
    expectedTotal: 928,
    expectedQuote: {
      items: [{ productId: PRODUCT_ID, price: 858, qty: 1 }],
      subtotal: 858,
      shipping: 70,
      giftWrapCost: 0,
      total: 928,
    },
  })), res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(createdOrders.length, 1);
  assert.equal(createdOrders[0].mehendiBooking, undefined);
  assert.equal(res.body.order.mehendiBooking, undefined);
});

test('shipping quote applies configured same-PIN, same-district, same-state, and different-state rates', async (t) => {
  withOrderMocks(t, { price: 858 });
  const addresses = [
    [{ city: 'Other', state: 'Telangana', pincode: '506001' }, 30, 'samePIN'],
    [{ city: 'Hanumakonda', state: 'Telangana', pincode: '506002' }, 50, 'sameDistrict'],
    [{ city: 'Hanamkonda', state: 'Telangana', pincode: '506003' }, 50, 'sameDistrict'],
    [{ city: 'Hyderabad', state: 'Telangana', pincode: '500001' }, 70, 'sameState'],
    [{ city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' }, 100, 'differentState'],
  ];
  for (const [address, expectedShipping, expectedGroup] of addresses) {
    const res = mockResponse();
    await orderController.quoteOrder(request({
      items: [{ productId: PRODUCT_ID, qty: 1 }],
      address,
    }), res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.shipping, expectedShipping);
    assert.equal(res.body.deliveryInfo.group, expectedGroup);
  }
});

test('server quote returns the full price without a discount', async (t) => {
  withOrderMocks(t, { price: 858 });
  const res = mockResponse();
  await orderController.quoteOrder(request(checkoutBody()), res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    {
      subtotal: res.body.subtotal,
      shipping: res.body.shipping,
      giftWrapCost: res.body.giftWrapCost,
      total: res.body.total,
    },
    { subtotal: 858, shipping: 70, giftWrapCost: 0, total: 928 }
  );
});

test('server quote rejects coupon codes', async (t) => {
  withOrderMocks(t, { price: 858 });
  const res = mockResponse();
  await orderController.quoteOrder(request(checkoutBody({ couponCode: 'RETIRED_PROMO' })), res);
  assert.equal(res.statusCode, 410);
  assert.match(res.body.message, /no longer available/i);
});

test('order creation rejects coupon codes', async (t) => {
  const { createdOrders } = withOrderMocks(t, { price: 858 });
  const res = mockResponse();
  await orderController.placeOrder(request(checkoutBody({ couponCode: 'RETIRED_PROMO' })), res);
  assert.equal(res.statusCode, 410);
  assert.match(res.body.message, /no longer available/i);
  assert.equal(createdOrders.length, 0);
});

test('expectedTotal mismatch returns 409 with per-field differences and does not create an order', async (t) => {
  const { createdOrders } = withOrderMocks(t, { price: 858 });
  const res = mockResponse();
  await orderController.placeOrder(request(checkoutBody({ expectedTotal: 900 })), res, (error) => { throw error; });

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.quote.total, 928);
  assert.ok(res.body.mismatches.some((mismatch) => mismatch.field === 'total'));
  assert.equal(createdOrders.length, 0);
});

test('expected quote detects shipping changes even when the payable total is unchanged', async (t) => {
  const { createdOrders } = withOrderMocks(t, { price: 858 });
  const res = mockResponse();
  const expectedQuote = {
    items: [{ productId: PRODUCT_ID, price: 858, qty: 1 }],
    subtotal: 858,
    shipping: 50,
    giftWrapCost: 0,
    total: 928,
  };
  await orderController.placeOrder(request(checkoutBody({
    expectedTotal: 928,
    expectedQuote,
  })), res, (error) => { throw error; });

  assert.equal(res.statusCode, 409);
  assert.ok(res.body.mismatches.some((mismatch) => mismatch.field === 'shipping'));
  assert.equal(createdOrders.length, 0);
});

test('matching quote and expectedTotal create and save the authoritative order breakdown', async (t) => {
  const { createdOrders } = withOrderMocks(t, { price: 858 });
  const quoteResponse = mockResponse();
  await orderController.quoteOrder(request(checkoutBody()), quoteResponse, (error) => { throw error; });

  const body = checkoutBody({
    expectedTotal: quoteResponse.body.total,
    expectedQuote: quoteResponse.body,
  });
  const res = mockResponse();
  await orderController.placeOrder(request(body), res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(createdOrders.length, 1);
  assert.equal(createdOrders[0].subtotal, 858);
  assert.equal(createdOrders[0].shipping, 70);
  assert.equal(createdOrders[0].discount, 0);
  assert.equal(createdOrders[0].couponCode, undefined);
  assert.equal(createdOrders[0].giftWrapCost, 0);
  assert.equal(createdOrders[0].total, 928);
  assert.equal(res.body.order.total, 928);
});
