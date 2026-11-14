// Central configuration. Values can be overridden with environment variables.
module.exports = {
  PORT: Number(process.env.PORT) || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'bookstore-dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2h',
  BCRYPT_ROUNDS: 10,
  MAX_QUERY_LENGTH: 100,
  MIN_QTY: 1,
  MAX_QTY: 10,
  LOW_STOCK_LIMIT: 3,
  // Mock payment cards
  CARD_SUCCESS: '4242424242424242',
  CARD_DECLINED: '4000000000000002',
};
