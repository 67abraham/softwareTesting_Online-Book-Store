// Central configuration. Values can be overridden with environment variables.
module.exports = {
  PORT: Number(process.env.PORT) || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'bookstore-dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2h',
  BCRYPT_ROUNDS: 10,
  // Login lockout: after this many failed attempts for one email (from one IP),
  // further attempts are blocked for the window below.
  LOGIN_MAX_FAILURES: Number(process.env.LOGIN_MAX_FAILURES) || 5,
  LOGIN_LOCK_MINUTES: Number(process.env.LOGIN_LOCK_MINUTES) || 15,
  MAX_QUERY_LENGTH: 100,
  MIN_QTY: 1,
  MAX_QTY: 10,
  LOW_STOCK_LIMIT: 3,
  // Mock payment cards
  CARD_SUCCESS: '4242424242424242',
  CARD_DECLINED: '4000000000000002',
};
