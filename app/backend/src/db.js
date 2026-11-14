// SQLite connection + schema.
// The whole database is one file: app/backend/data/bookstore.db
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'bookstore.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS books (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    author      TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    price       REAL NOT NULL CHECK (price >= 0),
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    description TEXT,
    isbn        TEXT
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id  INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    UNIQUE (user_id, book_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no     TEXT NOT NULL UNIQUE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total        REAL NOT NULL,
    status       TEXT NOT NULL DEFAULT 'Placed'
                 CHECK (status IN ('Placed', 'Shipped', 'Delivered', 'Cancelled')),
    ship_name    TEXT NOT NULL,
    ship_address TEXT NOT NULL,
    ship_city    TEXT NOT NULL,
    ship_postal  TEXT NOT NULL,
    ship_phone   TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    book_id    INTEGER NOT NULL REFERENCES books(id),
    title      TEXT NOT NULL,
    unit_price REAL NOT NULL,
    quantity   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
  CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders(user_id);
`);

module.exports = { db, DB_PATH };
