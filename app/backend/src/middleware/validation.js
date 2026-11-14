// Small, readable validation helpers. Messages match CLAUDE.md exactly.

const MSG = {
  REQUIRED: 'This field is required.',
  NAME_LENGTH: 'Name must be between 2 and 50 characters.',
  EMAIL_FORMAT: 'Please enter a valid email address.',
  PASSWORD_WEAK: 'Password must be at least 8 characters and contain a letter and a number.',
  PASSWORD_MISMATCH: 'Passwords do not match.',
  FULL_NAME_TOO_LONG: 'Full name must be 50 characters or less.',
  ADDRESS_TOO_LONG: 'Address must be 200 characters or less.',
  CITY_TOO_LONG: 'City must be 100 characters or less.',
  POSTAL_CODE: 'Postal code must be 4 to 10 digits.',
  PHONE: 'Please enter a valid phone number.',
  CARD_NUMBER: 'Card number must be 16 digits.',
  EXPIRY_FORMAT: 'Expiry date must be in MM/YY format.',
  CARD_EXPIRED: 'Card has expired.',
  CVV: 'CVV must be 3 digits.',
  QUANTITY: 'Quantity must be between 1 and 10.',
};

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const str = (v) => (v === undefined || v === null ? '' : String(v).trim());

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const POSTAL_RE = /^\d{4,10}$/;
const PHONE_RE = /^\+?\d{7,15}$/;
const CARD_RE = /^\d{16}$/;
const EXPIRY_RE = /^(0[1-9]|1[0-2])\/(\d{2})$/;
const CVV_RE = /^\d{3}$/;

// Removes spaces and dashes, e.g. "4242 4242 4242 4242" -> "4242424242424242"
const digitsOnly = (v) => str(v).replace(/[\s-]/g, '');

// Card is valid through the last day of its expiry month.
function isExpired(expiry, now = new Date()) {
  const [, mm, yy] = expiry.match(EXPIRY_RE);
  const year = 2000 + Number(yy);
  const month = Number(mm);
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  return year < curYear || (year === curYear && month < curMonth);
}

function isValidQuantity(q) {
  return Number.isInteger(q) && q >= 1 && q <= 10;
}

module.exports = {
  MSG,
  isBlank,
  str,
  digitsOnly,
  isExpired,
  isValidQuantity,
  EMAIL_RE,
  PASSWORD_RE,
  POSTAL_RE,
  PHONE_RE,
  CARD_RE,
  EXPIRY_RE,
  CVV_RE,
};
