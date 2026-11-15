// F4 - Checkout and place orders
// F5 - Order history
const express = require('express');
const { db } = require('../db');
const { CARD_DECLINED } = require('../config');
const { AppError, throwIfInvalid } = require('../middleware/errors');
const { requireAuth } = require('../middleware/auth');
const { getCart, round2 } = require('./cart');
const {
  MSG,
  isBlank,
  str,
  digitsOnly,
  isExpired,
  POSTAL_RE,
  PHONE_RE,
  CARD_RE,
  EXPIRY_RE,
  CVV_RE,
} = require('../middleware/validation');

const router = express.Router();
router.use(requireAuth());

// ---------- Validation ----------

function validateCheckout(shipping = {}, payment = {}) {
  const s = {
    fullName: str(shipping.fullName),
    address: str(shipping.address),
    city: str(shipping.city),
    postalCode: str(shipping.postalCode),
    phone: digitsOnly(shipping.phone),
  };
  const p = {
    cardNumber: digitsOnly(payment.cardNumber),
    expiry: str(payment.expiry),
    cvv: str(payment.cvv),
  };

  const fields = {};
  for (const key of ['fullName', 'address', 'city', 'postalCode', 'phone']) {
    if (isBlank(s[key])) fields[key] = MSG.REQUIRED;
  }
  for (const key of ['cardNumber', 'expiry', 'cvv']) {
    if (isBlank(p[key])) fields[key] = MSG.REQUIRED;
  }

  // Longest allowed text for the free-text shipping fields.
  const maxLength = [
    ['fullName', 50, MSG.FULL_NAME_TOO_LONG],
    ['address', 200, MSG.ADDRESS_TOO_LONG],
    ['city', 100, MSG.CITY_TOO_LONG],
  ];
  for (const [key, max, message] of maxLength) {
    if (!fields[key] && s[key].length > max) fields[key] = message;
  }

  if (!fields.postalCode && !POSTAL_RE.test(s.postalCode)) fields.postalCode = MSG.POSTAL_CODE;
  if (!fields.phone && !PHONE_RE.test(s.phone)) fields.phone = MSG.PHONE;
  if (!fields.cardNumber && !CARD_RE.test(p.cardNumber)) fields.cardNumber = MSG.CARD_NUMBER;
  if (!fields.expiry) {
    if (!EXPIRY_RE.test(p.expiry)) fields.expiry = MSG.EXPIRY_FORMAT;
    else if (isExpired(p.expiry)) fields.expiry = MSG.CARD_EXPIRED;
  }
  if (!fields.cvv && !CVV_RE.test(p.cvv)) fields.cvv = MSG.CVV;

  throwIfInvalid(fields);
  return { shipping: s, payment: p };
}

// ---------- Order number: ORD-YYYYMMDD-XXXX ----------

function nextOrderNo(now = new Date()) {
  const ymd =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const prefix = `ORD-${ymd}-`;
  const last = db
    .prepare('SELECT order_no FROM orders WHERE order_no LIKE ? ORDER BY order_no DESC LIMIT 1')
    .get(prefix + '%');
  const seq = last ? Number(last.order_no.slice(prefix.length)) + 1 : 1;
  return prefix + String(seq).padStart(4, '0');
}

// ---------- Statements ----------

const getStock = db.prepare('SELECT stock FROM books WHERE id = ?');
const decrementStock = db.prepare('UPDATE books SET stock = stock - ? WHERE id = ?');
const clearCart = db.prepare('DELETE FROM cart_items WHERE user_id = ?');
const removeCartItem = db.prepare('DELETE FROM cart_items WHERE user_id = ? AND book_id = ?');
const insertOrder = db.prepare(`
  INSERT INTO orders (order_no, user_id, total, status, ship_name, ship_address, ship_city, ship_postal, ship_phone, created_at)
  VALUES (@orderNo, @userId, @total, 'Placed', @fullName, @address, @city, @postalCode, @phone, datetime('now'))
`);
const insertOrderItem = db.prepare(
  'INSERT INTO order_items (order_id, book_id, title, unit_price, quantity) VALUES (?, ?, ?, ?, ?)'
);

const MSG_BAD_SELECTION = 'Some of the selected books are not in your cart. Please review your cart.';

// Optional list of book ids the user ticked on the Cart page.
// Missing or empty -> null, meaning "order the whole cart" (the original behaviour).
function parseBookIds(value) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || !value.every((id) => Number.isInteger(id) && id > 0)) {
    throw new AppError(400, 'SELECTION_INVALID', MSG_BAD_SELECTION);
  }
  return value.length > 0 ? [...new Set(value)] : null;
}

// Runs inside one transaction so stock check + order creation are atomic.
// bookIds: null = whole cart, or the ids of the selected cart items.
const placeOrder = db.transaction((userId, shipping, payment, bookIds) => {
  const cart = getCart(userId);
  if (cart.items.length === 0) {
    throw new AppError(400, 'EMPTY_CART', 'Your cart is empty. Add books before checking out.');
  }

  // Only the selected books (every selected id must still be in the cart).
  let items = cart.items;
  if (bookIds) {
    const wanted = new Set(bookIds);
    items = cart.items.filter((i) => wanted.has(i.bookId));
    if (items.length !== wanted.size) {
      throw new AppError(400, 'SELECTION_INVALID', MSG_BAD_SELECTION);
    }
  }

  // Re-check stock with the latest values.
  for (const item of items) {
    const { stock } = getStock.get(item.bookId);
    if (item.quantity > stock) {
      throw new AppError(409, 'STOCK_CHANGED', `"${item.title}" has only ${stock} copies left. Please update your cart.`);
    }
  }

  // Mock payment
  if (payment.cardNumber === CARD_DECLINED) {
    throw new AppError(402, 'PAYMENT_DECLINED', 'Payment declined. Please use a different card.');
  }

  // Total is calculated on the server from current prices.
  const total = round2(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const orderNo = nextOrderNo();
  const info = insertOrder.run({ orderNo, userId, total, ...shipping });
  const orderId = info.lastInsertRowid;

  for (const item of items) {
    insertOrderItem.run(orderId, item.bookId, item.title, item.price, item.quantity);
    decrementStock.run(item.quantity, item.bookId);
  }

  // Remove only the ordered books; anything not selected stays in the cart.
  if (bookIds) {
    for (const item of items) removeCartItem.run(userId, item.bookId);
  } else {
    clearCart.run(userId);
  }

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  return { id: Number(orderId), orderNo, total, status: 'Placed', itemCount };
});

// ---------- Routes ----------

// POST /api/orders  { shipping: {...}, payment: {...}, bookIds?: [3, 8] }
// bookIds is optional: without it the whole cart is ordered.
router.post('/', (req, res) => {
  const body = req.body || {};

  // Empty-cart check comes first so the user is told before filling the form.
  if (getCart(req.user.id).items.length === 0) {
    throw new AppError(400, 'EMPTY_CART', 'Your cart is empty. Add books before checking out.');
  }

  const bookIds = parseBookIds(body.bookIds);
  const { shipping, payment } = validateCheckout(body.shipping, body.payment);
  const order = placeOrder(req.user.id, shipping, payment, bookIds);

  res.status(201).json({
    message: `Order placed successfully! Your order number is ${order.orderNo}.`,
    order,
    cart: getCart(req.user.id), // what is left in the cart (empty after a whole-cart order)
  });
});

// GET /api/orders  (newest first)
router.get('/', (req, res) => {
  const orders = db
    .prepare(
      `SELECT o.id, o.order_no AS orderNo, o.created_at AS createdAt, o.total, o.status,
              COALESCE(SUM(oi.quantity), 0) AS itemCount
       FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC, o.id DESC`
    )
    .all(req.user.id);

  const body = { orders };
  if (orders.length === 0) body.message = 'You have not placed any orders yet.';
  res.json(body);
});

// GET /api/orders/:id  (own orders only; anything else is 404)
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const order = Number.isInteger(id)
    ? db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, req.user.id)
    : undefined;

  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');

  const items = db
    .prepare(
      'SELECT book_id AS bookId, title, unit_price AS unitPrice, quantity FROM order_items WHERE order_id = ? ORDER BY id'
    )
    .all(order.id)
    .map((i) => ({ ...i, subtotal: round2(i.unitPrice * i.quantity) }));

  res.json({
    order: {
      id: order.id,
      orderNo: order.order_no,
      createdAt: order.created_at,
      status: order.status,
      total: order.total,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      shipping: {
        fullName: order.ship_name,
        address: order.ship_address,
        city: order.ship_city,
        postalCode: order.ship_postal,
        phone: order.ship_phone,
      },
      items,
    },
  });
});

module.exports = router;
