// Express app for the Online Book Store System. Runs on port 4000.
const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');
const { DB_PATH } = require('./db');
const { notFoundRoute, errorHandler } = require('./middleware/errors');

const authRoutes = require('./routes/auth');
const { booksRouter, categoriesRouter } = require('./routes/books');
const { cartRouter } = require('./routes/cart');
const orderRoutes = require('./routes/orders');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRouter);
app.use('/api/books', booksRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', orderRoutes);

app.use(notFoundRoute);
app.use(errorHandler);

// Start the server only when run directly (lets tests import the app).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Online Book Store API running on http://localhost:${PORT}`);
    console.log(`SQLite database: ${DB_PATH}`);
  });
}

module.exports = app;
