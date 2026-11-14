// One book in the search results: cover, category, title, author, price,
// stock status and an "Add to cart" button.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatPrice, stockLevel } from '../format';
import { useAuth } from '../auth';
import { useCart } from '../cart';
import { useToast } from './Toast';

export const MSG_GUEST_ADD = 'Please log in to add books to your cart.';

export default function BookCard({ book }) {
  const level = stockLevel(book.stock);
  const outOfStock = level === 'out';

  const { user } = useAuth();
  const { addToCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    // Guests are sent to Login and brought back to this same search afterwards.
    if (!user) {
      navigate('/login', {
        state: { message: MSG_GUEST_ADD, from: location.pathname + location.search },
      });
      return;
    }

    setAdding(true);
    try {
      const data = await addToCart(book.id, 1);
      toast.success(data.message); // "{title}" was added to your cart.
    } catch (err) {
      // 409 out of stock / "Only {stock} copies available.", 400 "Quantity must be between 1 and 10."
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className="book-card" data-testid="book-card">
      {/* Simple generated cover, coloured by category (no images needed) */}
      <div className="book-card__cover" data-category={book.category} aria-hidden="true">
        <span className="book-card__cover-title">{book.title}</span>
        <span className="book-card__cover-author">{book.author}</span>
      </div>

      <div className="book-card__body">
        <p className="book-card__category">{book.category}</p>
        <h3 className="book-card__title">{book.title}</h3>
        <p className="book-card__author">by {book.author}</p>

        <div className="book-card__footer">
          <span className="book-card__price">{formatPrice(book.price)}</span>
          <span className={`stock stock--${level}`} data-testid="stock-status">
            {book.stockStatus}
          </span>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--block book-card__add"
          onClick={handleAdd}
          disabled={outOfStock || adding}
          aria-label={outOfStock ? `${book.title} is out of stock` : `Add ${book.title} to cart`}
        >
          {outOfStock ? 'Out of stock' : adding ? 'Adding…' : 'Add to cart'}
        </button>
      </div>
    </article>
  );
}
