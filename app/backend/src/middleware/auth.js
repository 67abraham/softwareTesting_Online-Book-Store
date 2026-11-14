// JWT authentication middleware.
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../config');
const { AppError } = require('./errors');

const MSG_LOGIN_REQUIRED = 'Please log in to continue.';
const MSG_SESSION_EXPIRED = 'Your session has expired. Please log in again.';

const findUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?');

// requireAuth() -> uses the default guest message.
// requireAuth('Custom message') -> used e.g. for "Please log in to add books to your cart."
function requireAuth(guestMessage = MSG_LOGIN_REQUIRED) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return next(new AppError(401, 'UNAUTHENTICATED', guestMessage));
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError(401, 'TOKEN_EXPIRED', MSG_SESSION_EXPIRED));
      }
      return next(new AppError(401, 'UNAUTHENTICATED', guestMessage));
    }

    // The user may have been removed (e.g. database reseeded).
    const user = findUser.get(payload.sub);
    if (!user) {
      return next(new AppError(401, 'TOKEN_EXPIRED', MSG_SESSION_EXPIRED));
    }

    req.user = user;
    next();
  };
}

module.exports = { requireAuth, MSG_LOGIN_REQUIRED, MSG_SESSION_EXPIRED };
