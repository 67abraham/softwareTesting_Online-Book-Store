// Client-side validation. The rules and messages match the backend exactly
// (app/backend/src/middleware/validation.js) and the contract in CLAUDE.md.

export const MSG = {
  REQUIRED: 'This field is required.',
  NAME_LENGTH: 'Name must be between 2 and 50 characters.',
  EMAIL_FORMAT: 'Please enter a valid email address.',
  PASSWORD_WEAK: 'Password must be at least 8 characters and contain a letter and a number.',
  PASSWORD_MISMATCH: 'Passwords do not match.',
  SEARCH_TOO_LONG: 'Search text must be 100 characters or less.',
  QUANTITY: 'Quantity must be between 1 and 10.',
  FULL_NAME_TOO_LONG: 'Full name must be 50 characters or less.',
  ADDRESS_TOO_LONG: 'Address must be 200 characters or less.',
  CITY_TOO_LONG: 'City must be 100 characters or less.',
  POSTAL_CODE: 'Postal code must be 4 to 10 digits.',
  PHONE: 'Please enter a valid phone number.',
  CARD_NUMBER: 'Card number must be 16 digits.',
  EXPIRY_FORMAT: 'Expiry date must be in MM/YY format.',
  CARD_EXPIRED: 'Card has expired.',
  CVV: 'CVV must be 3 digits.',
};

// ---------- Checkout (same rules as app/backend/src/routes/orders.js) ----------

const POSTAL_RE = /^\d{4,10}$/;
const PHONE_RE = /^\+?\d{7,15}$/;
const CARD_RE = /^\d{16}$/;
const EXPIRY_RE = /^(0[1-9]|1[0-2])\/(\d{2})$/;
const CVV_RE = /^\d{3}$/;

// "4242 4242-4242 4242" -> "4242424242424242" (spaces and dashes are allowed)
const digitsOnly = (v) => v.trim().replace(/[\s-]/g, '');

// A card is valid until the end of its expiry month.
function isExpired(expiry, now = new Date()) {
  const [, mm, yy] = expiry.match(EXPIRY_RE);
  const year = 2000 + Number(yy);
  const month = Number(mm);
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
}

export const SHIPPING_FIELDS = ['fullName', 'address', 'city', 'postalCode', 'phone'];

// Longest allowed text for the free-text shipping fields (same limits on the server).
const SHIPPING_MAX_LENGTH = [
  ['fullName', 50, MSG.FULL_NAME_TOO_LONG],
  ['address', 200, MSG.ADDRESS_TOO_LONG],
  ['city', 100, MSG.CITY_TOO_LONG],
];
export const PAYMENT_FIELDS = ['cardNumber', 'expiry', 'cvv'];

// values: { fullName, address, city, postalCode, phone, cardNumber, expiry, cvv }
export function validateCheckout(values) {
  const fields = {};
  for (const key of [...SHIPPING_FIELDS, ...PAYMENT_FIELDS]) {
    if (!values[key].trim()) fields[key] = MSG.REQUIRED;
  }

  for (const [key, max, message] of SHIPPING_MAX_LENGTH) {
    if (!fields[key] && values[key].trim().length > max) fields[key] = message;
  }
  if (!fields.postalCode && !POSTAL_RE.test(values.postalCode.trim())) fields.postalCode = MSG.POSTAL_CODE;
  if (!fields.phone && !PHONE_RE.test(digitsOnly(values.phone))) fields.phone = MSG.PHONE;
  if (!fields.cardNumber && !CARD_RE.test(digitsOnly(values.cardNumber))) fields.cardNumber = MSG.CARD_NUMBER;
  if (!fields.expiry) {
    const expiry = values.expiry.trim();
    if (!EXPIRY_RE.test(expiry)) fields.expiry = MSG.EXPIRY_FORMAT;
    else if (isExpired(expiry)) fields.expiry = MSG.CARD_EXPIRED;
  }
  if (!fields.cvv && !CVV_RE.test(values.cvv.trim())) fields.cvv = MSG.CVV;

  return fields;
}

export const MIN_QTY = 1;
export const MAX_QTY = 10;

// Returns the quantity as a number, or null if it is not a whole number from 1 to 10.
export function parseQuantity(value) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= MIN_QTY && n <= MAX_QTY ? n : null;
}

export const MAX_SEARCH_LENGTH = 100;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// Login only checks that both fields are filled in; the server decides if they are correct.
export function validateLogin({ email, password }) {
  const fields = {};
  if (!email.trim()) fields.email = MSG.REQUIRED;
  if (!password) fields.password = MSG.REQUIRED;
  return fields;
}

// Returns an object like { email: 'Please enter a valid email address.' }.
// An empty object means the form is valid.
export function validateRegister({ name, email, password, confirmPassword }) {
  const fields = {};
  const n = name.trim();
  const e = email.trim();

  if (!n) fields.name = MSG.REQUIRED;
  else if (n.length < 2 || n.length > 50) fields.name = MSG.NAME_LENGTH;

  if (!e) fields.email = MSG.REQUIRED;
  else if (!EMAIL_RE.test(e)) fields.email = MSG.EMAIL_FORMAT;

  if (!password) fields.password = MSG.REQUIRED;
  else if (!PASSWORD_RE.test(password)) fields.password = MSG.PASSWORD_WEAK;

  if (!confirmPassword) fields.confirmPassword = MSG.REQUIRED;
  else if (confirmPassword !== password) fields.confirmPassword = MSG.PASSWORD_MISMATCH;

  return fields;
}
