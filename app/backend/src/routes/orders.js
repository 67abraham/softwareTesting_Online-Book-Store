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
const insertOrder = db.prepare(`
  INSERT INTO orders (order_no, user_id, total, status, ship_name, ship_address, ship_city, ship_postal, ship_phone, created_at)
  VALUES (@orderNo, @userId, @total, 'Placed', @fullName, @address, @city, @postalCode, @phone, datetime('now'))
`);
const insertOrderItem = db.prepare(
  'INSERT INTO order_items (order_id, book_id, title, unit_price, quantity) VALUES (?, ?, ?, ?, ?)'
);

// Runs inside one transaction so stock check + order creation are atomic.
const placeOrder = db.transaction((userId, shipping, payment) => {
  const cart = getCart(userId);
  if (cart.items.length === 0) {
    throw new AppError(400, 'EMPTY_CART', 'Your cart is empty. Add books before checking out.');
  }

  // Re-check stock with the latest values.
  for (const item of cart.items) {
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
  const total = round2(cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const orderNo = nextOrderNo();
  const info = insertOrder.run({ orderNo, userId, total, ...shipping });
  const orderId = info.lastInsertRowid;

  for (const item of cart.items) {
    insertOrderItem.run(orderId, item.bookId, item.title, item.price, item.quantity);
    decrementStock.run(item.quantity, item.bookId);
  }
  clearCart.run(userId);

  return { id: Number(orderId), orderNo, total, status: 'Placed', itemCount: cart.itemCount };
});

// ---------- Routes ----------

// POST /api/orders  { shipping: {...}, payment: {...} }
router.post('/', (req, res) => {
  const body = req.body || {};

  // Empty-cart check comes first so the user is told before filling the form.
  if (getCart(req.user.id).items.length === 0) {
    throw new AppError(400, 'EMPTY_CART', 'Your cart is empty. Add books before checking out.');
  }

  const { shipping, payment } = validateCheckout(body.shipping, body.payment);
  const order = placeOrder(req.user.id, shipping, payment);

  res.status(201).json({
    message: `Order placed successfully! Your order number is ${order.orderNo}.`,
    order,
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
