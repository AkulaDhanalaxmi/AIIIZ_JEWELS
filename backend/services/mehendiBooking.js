const MEHENDI_SERVICE_PINS = Object.freeze(['506001', '506002', '506003']);
const MEHENDI_SERVICE_CITIES = Object.freeze({
  '506001': 'Hanamkonda',
  '506002': 'Warangal',
  '506003': 'Kazipet',
});

const MEHENDI_START_DATE = '2026-10-06';
const MEHENDI_END_DATE = '2026-10-20';
const MEHENDI_TIME_SLOTS = Object.freeze([
  '10:00 AM – 12:00 PM',
  '12:00 PM – 2:00 PM',
  '2:00 PM – 4:00 PM',
  '4:00 PM – 6:00 PM',
]);

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

function validateMehendiBooking(booking, now = new Date()) {
  if (booking == null) return { valid: true, booking: null };
  if (typeof booking !== 'object' || Array.isArray(booking)) {
    return { valid: false, message: 'Mehendi booking details are invalid.' };
  }

  const address = typeof booking.address === 'string' ? booking.address.trim() : '';
  const pincode = String(booking.pincode || '').trim();
  const date = typeof booking.date === 'string' ? booking.date.trim() : '';
  const timeSlot = typeof booking.timeSlot === 'string' ? booking.timeSlot.trim() : '';

  if (!address) {
    return { valid: false, message: 'Enter the mehendi service address.' };
  }
  if (address.length > 300) {
    return { valid: false, message: 'Mehendi service address must be 300 characters or fewer.' };
  }
  if (!/^\d{6}$/.test(pincode)) {
    return { valid: false, message: 'Enter a valid 6-digit mehendi service PIN code.' };
  }
  if (!MEHENDI_SERVICE_PINS.includes(pincode)) {
    return { valid: false, message: 'Mehendi service is not available for this location.' };
  }
  const city = MEHENDI_SERVICE_CITIES[pincode];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { valid: false, message: 'Select a valid mehendi booking date.' };
  }
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date ||
    date < MEHENDI_START_DATE ||
    date > MEHENDI_END_DATE ||
    date < indiaDateKey(now)
  ) {
    return { valid: false, message: 'Mehendi bookings are available from October 6 to October 20, 2026.' };
  }
  if (!MEHENDI_TIME_SLOTS.includes(timeSlot)) {
    return { valid: false, message: 'Select a valid mehendi time slot.' };
  }

  return {
    valid: true,
    booking: { address, pincode, city, date, timeSlot },
  };
}

module.exports = {
  MEHENDI_SERVICE_PINS,
  MEHENDI_SERVICE_CITIES,
  MEHENDI_TIME_SLOTS,
  validateMehendiBooking,
};
