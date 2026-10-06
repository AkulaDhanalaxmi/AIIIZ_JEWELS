const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MEHENDI_SERVICE_PINS,
  MEHENDI_SERVICE_CITIES,
  validateMehendiBooking,
} = require('../services/mehendiBooking');

const currentDate = new Date('2026-10-05T12:00:00Z');

function booking(overrides = {}) {
  return {
    address: '12 Temple Street, near the park',
    pincode: '506001',
    date: '2026-10-06',
    timeSlot: '10:00 AM – 12:00 PM',
    ...overrides,
  };
}

test('allows a booking with a valid tri-city PIN and derives city and weekday', () => {
  const result = validateMehendiBooking(booking(), currentDate);
  assert.equal(result.valid, true);
  assert.deepEqual(result.booking, {
    address: '12 Temple Street, near the park',
    pincode: '506001',
    city: 'Hanamkonda',
    date: '2026-10-06',
    timeSlot: '10:00 AM – 12:00 PM',
  });
});

test('allows only the configured mehendi service PINs', () => {
  for (const pincode of MEHENDI_SERVICE_PINS) {
    const result = validateMehendiBooking(booking({ pincode }), currentDate);
    assert.equal(result.valid, true);
    assert.equal(result.booking.city, MEHENDI_SERVICE_CITIES[pincode]);
  }

  const unavailable = validateMehendiBooking(booking({ pincode: '500001' }), currentDate);
  assert.equal(unavailable.valid, false);
  assert.match(unavailable.message, /not available for this location/i);
});

test('requires address, date, and a valid time slot', () => {
  assert.match(validateMehendiBooking(booking({ address: ' ' }), currentDate).message, /address/i);
  assert.match(validateMehendiBooking(booking({ date: '' }), currentDate).message, /date/i);
  assert.match(validateMehendiBooking(booking({ timeSlot: 'evening' }), currentDate).message, /time slot/i);
});

test('accepts all four two-hour time slots', () => {
  for (const timeSlot of [
    '10:00 AM – 12:00 PM',
    '12:00 PM – 2:00 PM',
    '2:00 PM – 4:00 PM',
    '4:00 PM – 6:00 PM',
  ]) {
    assert.equal(validateMehendiBooking(booking({ timeSlot }), currentDate).valid, true);
  }
});

test('limits dates to October 6 through October 20 and rejects past dates', () => {
  assert.equal(validateMehendiBooking(booking({ date: '2026-10-06' }), currentDate).valid, true);
  assert.equal(validateMehendiBooking(booking({ date: '2026-10-20' }), currentDate).valid, true);
  assert.equal(validateMehendiBooking(booking({ date: '2026-10-05' }), currentDate).valid, false);
  assert.equal(validateMehendiBooking(booking({ date: '2026-10-21' }), currentDate).valid, false);
  assert.equal(
    validateMehendiBooking(booking({ date: '2026-10-05' }), new Date('2026-10-06T12:00:00Z')).valid,
    false
  );
});

test('an order without a mehendi booking remains valid', () => {
  assert.deepEqual(validateMehendiBooking(null, currentDate), { valid: true, booking: null });
});
