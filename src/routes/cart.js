// F3 - Shopping cart (stored on the server per user)
const express = require('express');
const { db } = require('../db');
const { MAX_QTY } = require('../config');
const { AppError } = require('../middleware/errors');
const { requireAuth } = require('../middleware/auth');
const { MSG, isValidQuantity } = require('../middleware/validation');

const router = express.Router();

const round2 = (n) => Math.round(n * 100) / 100;

const findBook = db.prepare('SELECT id, title, price, stock FROM books WHERE id = ?');
const findItem = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND book_id = ?');
const insertItem = db.prepare('INSERT INTO cart_items (user_id, book_id, quantity) VALUES (?, ?, ?)');
const updateItem = db.prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND book_id = ?');
const deleteItem = db.prepare('DELETE FROM cart_items WHERE user_id = ? AND book_id = ?');
const listItems = db.prepare(`
  SELECT ci.book_id AS bookId, b.title, b.author, b.price, b.stock, ci.quantity
  FROM cart_items ci JOIN books b ON b.id = ci.book_id
  WHERE ci.user_id = ?
  ORDER BY ci.id
`);

// Builds the cart summary returned by every cart endpoint.
function getCart(userId) {
  const items = listItems.all(userId).map((i) => ({ ...i, subtotal: round2(i.price * i.quantity) }));
  const total = round2(items.reduce((sum, i) => sum + i.subtotal, 0));
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  return { items, itemCount, total };
}

function parseQuantity(value) {
  const q = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!isValidQuantity(q)) {
    throw new AppError(400, 'VALIDATION_ERROR', MSG.QUANTITY, { quantity: MSG.QUANTITY });
  }
  return q;
}

function loadBook(bookId) {
  const id = Number(bookId);
  const book = Number.isInteger(id) ? findBook.get(id) : undefined;
  if (!book) throw new AppError(404, 'NOT_FOUND', 'Book not found.');
  return book;
}

// Throws 409 if the wanted quantity is more than the stock.
function checkStock(book, wanted) {
  if (book.stock <= 0) {
    throw new AppError(409, 'OUT_OF_STOCK', 'Sorry, this book is out of stock.');
  }
  if (wanted > book.stock) {
    throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${book.stock} copies available.`);
  }
}

// GET /api/cart
router.get('/', requireAuth(), (req, res) => {
  res.json(getCart(req.user.id));
});

// POST /api/cart  { bookId, quantity }
router.post('/', requireAuth('Please log in to add books to your cart.'), (req, res) => {
  const body = req.body || {};
  const book = loadBook(body.bookId);
  const quantity = body.quantity === undefined ? 1 : parseQuantity(body.quantity);

  const existing = findItem.get(req.user.id, book.id);
  const newQty = (existing ? existing.quantity : 0) + quantity;

  checkStock(book, newQty);
  if (newQty > MAX_QTY) {
    throw new AppError(400, 'VALIDATION_ERROR', MSG.QUANTITY, { quantity: MSG.QUANTITY });
  }

  if (existing) updateItem.run(newQty, req.user.id, book.id);
  else insertItem.run(req.user.id, book.id, newQty);

  res.status(201).json({
    message: `"${book.title}" was added to your cart.`,
    cart: getCart(req.user.id),
  });
});

// PUT /api/cart/:bookId  { quantity }
router.put('/:bookId', requireAuth(), (req, res) => {
  const book = loadBook(req.params.bookId);
  const quantity = parseQuantity((req.body || {}).quantity);

  if (!findItem.get(req.user.id, book.id)) {
    throw new AppError(404, 'NOT_FOUND', 'This book is not in your cart.');
  }
  checkStock(book, quantity);

  updateItem.run(quantity, req.user.id, book.id);
  res.json({ message: 'Cart updated.', cart: getCart(req.user.id) });
});

// DELETE /api/cart/:bookId
router.delete('/:bookId', requireAuth(), (req, res) => {
  const book = loadBook(req.params.bookId);

  const info = deleteItem.run(req.user.id, book.id);
  if (info.changes === 0) {
    throw new AppError(404, 'NOT_FOUND', 'This book is not in your cart.');
  }

  res.json({
    message: `"${book.title}" was removed from your cart.`,
    cart: getCart(req.user.id),
  });
});

module.exports = { cartRouter: router, getCart, round2 };
