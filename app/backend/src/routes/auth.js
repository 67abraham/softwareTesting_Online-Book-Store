// F1 - Register and log in
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  BCRYPT_ROUNDS,
  LOGIN_MAX_FAILURES,
  LOGIN_LOCK_MINUTES,
} = require('../config');
const { AppError, throwIfInvalid } = require('../middleware/errors');
const { requireAuth } = require('../middleware/auth');
const { MSG, isBlank, str, EMAIL_RE, PASSWORD_RE } = require('../middleware/validation');

const router = express.Router();

const findByEmail = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
const insertUser = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

// ---------- Login protection ----------

// Used when the email does not exist, so a wrong email takes as long as a
// wrong password (stops attackers telling which emails are registered).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

// Failed login attempts in memory: key "email|ip" -> { count, firstAt }.
// Resets when the server restarts. Simple, but enough for this project.
const failedLogins = new Map();
const LOCK_MS = LOGIN_LOCK_MINUTES * 60 * 1000;
const MSG_TOO_MANY = `Too many failed login attempts. Please try again in ${LOGIN_LOCK_MINUTES} minutes.`;

function attemptKey(email, req) {
  return `${email.toLowerCase()}|${req.ip}`;
}

function isLocked(key) {
  const entry = failedLogins.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOCK_MS) {
    failedLogins.delete(key); // window has passed
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordFailure(key) {
  const entry = failedLogins.get(key);
  if (!entry || Date.now() - entry.firstAt > LOCK_MS) {
    failedLogins.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

// POST /api/auth/register  { name, email, password, confirmPassword }
router.post('/register', (req, res) => {
  const body = req.body || {};
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const password = body.password === undefined || body.password === null ? '' : String(body.password);
  const confirmPassword =
    body.confirmPassword === undefined || body.confirmPassword === null ? '' : String(body.confirmPassword);

  const fields = {};
  if (isBlank(name)) fields.name = MSG.REQUIRED;
  else if (name.length < 2 || name.length > 50) fields.name = MSG.NAME_LENGTH;

  if (isBlank(email)) fields.email = MSG.REQUIRED;
  else if (!EMAIL_RE.test(email)) fields.email = MSG.EMAIL_FORMAT;

  if (password === '') fields.password = MSG.REQUIRED;
  else if (!PASSWORD_RE.test(password)) fields.password = MSG.PASSWORD_WEAK;

  if (confirmPassword === '') fields.confirmPassword = MSG.REQUIRED;
  else if (confirmPassword !== password) fields.confirmPassword = MSG.PASSWORD_MISMATCH;

  throwIfInvalid(fields);

  if (findByEmail.get(email)) {
    const msg = 'This email is already registered.';
    throw new AppError(409, 'EMAIL_EXISTS', msg, { email: msg });
  }

  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const info = insertUser.run(name, email, hash);

  res.status(201).json({
    message: 'Account created successfully. Please log in.',
    user: { id: info.lastInsertRowid, name, email },
  });
});

// POST /api/auth/login  { email, password }  ->  { token, user, message }
router.post('/login', (req, res) => {
  const body = req.body || {};
  const email = str(body.email);
  const password = body.password === undefined || body.password === null ? '' : String(body.password);

  const fields = {};
  if (isBlank(email)) fields.email = MSG.REQUIRED;
  if (password === '') fields.password = MSG.REQUIRED;
  throwIfInvalid(fields);

  const key = attemptKey(email, req);
  if (isLocked(key)) {
    throw new AppError(429, 'TOO_MANY_ATTEMPTS', MSG_TOO_MANY);
  }

  // Always run one bcrypt check, even for unknown emails (same response time).
  const user = findByEmail.get(email);
  const passwordOk = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordOk) {
    recordFailure(key);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  failedLogins.delete(key); // successful login resets the counter

  const token = jwt.sign({ sub: user.id, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  res.json({
    message: `Welcome back, ${user.name}!`,
    token,
    user: publicUser(user),
  });
});

// GET /api/auth/me
router.get('/me', requireAuth(), (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
