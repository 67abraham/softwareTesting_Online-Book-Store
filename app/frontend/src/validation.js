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
};

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
