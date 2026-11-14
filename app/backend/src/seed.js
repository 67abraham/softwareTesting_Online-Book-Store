// Resets the database to a known state so test runs are repeatable.
//   npm run seed
// All names, emails and books are invented.
const bcrypt = require('bcrypt');
const { db, DB_PATH } = require('./db');
const { BCRYPT_ROUNDS } = require('./config');

const CATEGORIES = ['Fiction', 'Science', 'History', 'Technology', 'Children', 'Business'];

// [title, author, category, price, stock, isbn]
// Out of stock (0): "The Silent Harbor", "Quantum Gardens"
// Low stock (1-3): "Echoes of the Valley" (1), "Empires of Sand" (2), "Learning JavaScript the Simple Way" (3)
const BOOKS = [
  // Fiction
  ['The Silent Harbor', 'Margaret Ellison', 'Fiction', 14.99, 0, '978-1-00000-001-1'],
  ['Echoes of the Valley', 'Daniel Okafor', 'Fiction', 12.5, 1, '978-1-00000-002-8'],
  ['The Last Lighthouse Keeper', 'Sofia Marquez', 'Fiction', 16.99, 25, '978-1-00000-003-5'],
  ['A Winter in Lisbon', 'Henry Calloway', 'Fiction', 11.99, 18, '978-1-00000-004-2'],
  ['Midnight at the Orchard', 'Priya Natarajan', 'Fiction', 9.99, 40, '978-1-00000-005-9'],
  // Science
  ['Quantum Gardens', 'Dr. Elena Varga', 'Science', 29.99, 0, '978-1-00000-006-6'],
  ['The Hidden Life of Cells', 'Marcus Lindqvist', 'Science', 24.5, 12, '978-1-00000-007-3'],
  ['Stars Within Reach', 'Amara Bello', 'Science', 19.99, 20, '978-1-00000-008-0'],
  ['Understanding Climate Science', 'Thomas Reed', 'Science', 34.0, 9, '978-1-00000-009-7'],
  ['The Chemistry of Everyday Things', 'Lucy Hartmann', 'Science', 17.75, 15, '978-1-00000-010-3'],
  // History
  ['Empires of Sand', 'Rashid Kamal', 'History', 27.99, 2, '978-1-00000-011-0'],
  ['The Silk Road Chronicles', 'Mei Lin Zhou', 'History', 22.0, 14, '978-1-00000-012-7'],
  ['Kings, Queens and Crowns', 'Edward Ashford', 'History', 18.99, 30, '978-1-00000-013-4'],
  ['The Forgotten War', 'Nadia Petrova', 'History', 21.5, 7, '978-1-00000-014-1'],
  ['A Short History of Trade', 'George Mensah', 'History', 15.99, 11, '978-1-00000-015-8'],
  // Technology
  ['Learning JavaScript the Simple Way', 'Kevin Tran', 'Technology', 39.99, 3, '978-1-00000-016-5'],
  ['Databases Made Easy', 'Ingrid Solberg', 'Technology', 44.95, 16, '978-1-00000-017-2'],
  ['Software Testing in Practice', 'Rahul Mehta', 'Technology', 49.99, 22, '978-1-00000-018-9'],
  ['The Cloud Handbook', 'Olivia Brandt', 'Technology', 59.99, 10, '978-1-00000-019-6'],
  ['Web Design Basics', 'Carlos Rivera', 'Technology', 29.5, 35, '978-1-00000-020-2'],
  // Children
  ['The Brave Little Turtle', 'Hannah Wells', 'Children', 7.99, 50, '978-1-00000-021-9'],
  ['Moon Bear Goes to School', 'Kenji Watanabe', 'Children', 6.5, 45, '978-1-00000-022-6'],
  ['The Dragon Who Loved Books', 'Fiona McAllister', 'Children', 8.99, 28, '978-1-00000-023-3'],
  ['Counting with Penguins', 'Lily Andersson', 'Children', 5.99, 60, '978-1-00000-024-0'],
  ['Adventures in the Treehouse', 'Samuel Brooks', 'Children', 9.5, 19, '978-1-00000-025-7'],
  // Business
  ['Small Business, Big Ideas', 'Rachel Kimura', 'Business', 23.99, 13, '978-1-00000-026-4'],
  ['The Art of Negotiation', 'Victor Osei', 'Business', 26.5, 17, '978-1-00000-027-1'],
  ['Marketing for Beginners', 'Chloe Dubois', 'Business', 19.5, 24, '978-1-00000-028-8'],
  ['Money Matters', 'Benjamin Clarke', 'Business', 14.99, 33, '978-1-00000-029-5'],
  ['Leading Teams That Work', 'Aisha Rahman', 'Business', 31.0, 8, '978-1-00000-030-1'],
];

const USERS = [
  { name: 'Alice Johnson', email: 'alice@example.com', password: 'Password123' },
  { name: 'Bob Smith', email: 'bob@example.com', password: 'Password123' },
];

// Alice's past orders (historical, so stock is not changed by these).
const ALICE_ORDERS = [
  {
    orderNo: 'ORD-20260912-0001',
    createdAt: '2026-09-12 10:15:00',
    status: 'Delivered',
    items: [
      ['The Last Lighthouse Keeper', 1],
      ['Stars Within Reach', 2],
    ],
  },
  {
    orderNo: 'ORD-20261020-0001',
    createdAt: '2026-10-20 14:42:00',
    status: 'Shipped',
    items: [['Software Testing in Practice', 1]],
  },
  {
    orderNo: 'ORD-20261105-0001',
    createdAt: '2026-11-05 09:05:00',
    status: 'Cancelled',
    items: [
      ['The Brave Little Turtle', 3],
      ['Money Matters', 1],
    ],
  },
];

const ALICE_SHIPPING = {
  name: 'Alice Johnson',
  address: '12 Maple Street',
  city: 'Springfield',
  postal: '12345',
  phone: '+15550101234',
};

function description(title, author, category) {
  return `"${title}" by ${author} is a popular ${category.toLowerCase()} title in our store.`;
}

const seed = db.transaction(() => {
  // Wipe everything (children first because of foreign keys).
  for (const table of ['order_items', 'orders', 'cart_items', 'books', 'categories', 'users']) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  db.prepare('DELETE FROM sqlite_sequence').run();

  const catIds = {};
  const insertCat = db.prepare('INSERT INTO categories (name) VALUES (?)');
  for (const name of CATEGORIES) catIds[name] = insertCat.run(name).lastInsertRowid;

  const bookIds = {};
  const bookPrices = {};
  const insertBook = db.prepare(
    'INSERT INTO books (title, author, category_id, price, stock, description, isbn) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const [title, author, cat, price, stock, isbn] of BOOKS) {
    bookIds[title] = insertBook.run(title, author, catIds[cat], price, stock, description(title, author, cat), isbn)
      .lastInsertRowid;
    bookPrices[title] = price;
  }

  const userIds = {};
  const insertUser = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
  for (const u of USERS) {
    userIds[u.email] = insertUser.run(u.name, u.email, bcrypt.hashSync(u.password, BCRYPT_ROUNDS)).lastInsertRowid;
  }

  const insertOrder = db.prepare(`
    INSERT INTO orders (order_no, user_id, total, status, ship_name, ship_address, ship_city, ship_postal, ship_phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, book_id, title, unit_price, quantity) VALUES (?, ?, ?, ?, ?)'
  );
  const s = ALICE_SHIPPING;
  for (const o of ALICE_ORDERS) {
    const total = Math.round(o.items.reduce((sum, [t, q]) => sum + bookPrices[t] * q, 0) * 100) / 100;
    const orderId = insertOrder.run(
      o.orderNo, userIds['alice@example.com'], total, o.status,
      s.name, s.address, s.city, s.postal, s.phone, o.createdAt
    ).lastInsertRowid;
    for (const [title, qty] of o.items) insertItem.run(orderId, bookIds[title], title, bookPrices[title], qty);
  }
});

seed();

const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
console.log(`Database seeded: ${DB_PATH}`);
console.log(
  `  categories=${count('categories')} books=${count('books')} users=${count('users')} orders=${count('orders')}`
);
console.log('  Demo users: alice@example.com / bob@example.com (password: Password123)');
