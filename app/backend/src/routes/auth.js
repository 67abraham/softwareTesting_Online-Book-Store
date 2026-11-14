// F1 - Register and log in
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS } = require('../config');
const { AppError, throwIfInvalid } = require('../middleware/errors');
const { requireAuth } = require('../middleware/auth');
const { MSG, isBlank, str, EMAIL_RE, PASSWORD_RE } = require('../middleware/validation');

const router = express.Router();

const findByEmail = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
const insertUser = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

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

  const user = findByEmail.get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

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
