// F2 - Search books by title or category (public, no login needed)
const express = require('express');
const { db } = require('../db');
const { MAX_QUERY_LENGTH, LOW_STOCK_LIMIT } = require('../config');
const { AppError } = require('../middleware/errors');

const router = express.Router();

const BOOK_COLUMNS = `
  b.id, b.title, b.author, b.price, b.stock, b.description, b.isbn,
  b.category_id AS categoryId, c.name AS category
`;

function stockStatus(stock) {
  if (stock <= 0) return 'Out of stock';
  if (stock <= LOW_STOCK_LIMIT) return `Only ${stock} left`;
  return 'In stock';
}

const withStatus = (b) => ({ ...b, stockStatus: stockStatus(b.stock) });

// Escape LIKE wildcards so %, _ and \ are matched as plain text.
const escapeLike = (s) => s.replace(/[\\%_]/g, (ch) => '\\' + ch);

// GET /api/categories
const categoriesRouter = express.Router();
categoriesRouter.get('/', (req, res) => {
  const categories = db.prepare('SELECT id, name FROM categories ORDER BY name').all();
  res.json({ categories });
});

// GET /api/books?q=&category=
// category may be a category id (e.g. 2) or a name (e.g. "Science").
router.get('/', (req, res) => {
  const rawQ = typeof req.query.q === 'string' ? req.query.q : '';
  const q = rawQ.trim();
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

  if (q.length > MAX_QUERY_LENGTH) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Search text must be 100 characters or less.', {
      q: 'Search text must be 100 characters or less.',
    });
  }

  const where = [];
  const params = {};

  if (q) {
    where.push(`b.title LIKE @q ESCAPE '\\'`); // LIKE is case-insensitive for ASCII in SQLite
    params.q = `%${escapeLike(q)}%`;
  }
  if (category) {
    if (/^\d+$/.test(category)) {
      where.push('b.category_id = @categoryId');
      params.categoryId = Number(category);
    } else {
      where.push('c.name = @categoryName COLLATE NOCASE');
      params.categoryName = category;
    }
  }

  const sql = `
    SELECT ${BOOK_COLUMNS}
    FROM books b JOIN categories c ON c.id = b.category_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY b.title
  `;
  const books = db.prepare(sql).all(params).map(withStatus);

  const message =
    books.length > 0
      ? `${books.length} book(s) found.`
      : `No books found matching "${q}". Try a different title or category.`;

  res.json({ query: q, category: category || null, count: books.length, message, books });
});

// GET /api/books/:id
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const book = Number.isInteger(id)
    ? db
        .prepare(`SELECT ${BOOK_COLUMNS} FROM books b JOIN categories c ON c.id = b.category_id WHERE b.id = ?`)
        .get(id)
    : undefined;

  if (!book) throw new AppError(404, 'NOT_FOUND', 'Book not found.');
  res.json({ book: withStatus(book) });
});

module.exports = { booksRouter: router, categoriesRouter, stockStatus };
