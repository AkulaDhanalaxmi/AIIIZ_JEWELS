const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

test('frontend prevents concurrent place-order calls and restores the button after completion', async () => {
  const htmlPath = path.resolve(__dirname, '../../frontend/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const start = html.indexOf('async function placeOrder(){');
  const end = html.indexOf('\nasync function submitOrder(){', start);

  assert.notEqual(start, -1, 'placeOrder function should exist in the frontend');
  assert.notEqual(end, -1, 'submitOrder should follow placeOrder in the frontend');

  const placeOrderSource = html.slice(start, end);
  const button = { disabled: false, textContent: '' };
  let releaseSubmit;
  let submitCount = 0;
  let renderCount = 0;
  const context = vm.createContext({
    document: {
      querySelector: () => button,
    },
    renderPayment: () => {
      renderCount += 1;
      button.disabled = false;
    },
    submitOrder: () => {
      submitCount += 1;
      return new Promise((resolve) => { releaseSubmit = resolve; });
    },
  });

  vm.runInContext(`let placeOrderInFlight = false;\n${placeOrderSource}`, context);
  const firstSubmission = vm.runInContext('placeOrder()', context);
  const duplicateSubmission = vm.runInContext('placeOrder()', context);

  assert.equal(submitCount, 1);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'PLACING ORDER…');

  releaseSubmit();
  await Promise.all([firstSubmission, duplicateSubmission]);

  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'PLACE ORDER →');
  assert.equal(renderCount, 1);
});
