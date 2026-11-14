// F3 - Shopping cart page (logged-in users only). Route: "/cart"
// Shows each item with quantity controls, line subtotal and remove button,
// plus the cart total. The cart is stored on the server per user.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../cart';
import { useToast } from '../components/Toast';
import { formatPrice, stockLevel } from '../format';
import { MAX_QTY, MSG, parseQuantity } from '../validation';

export default function Cart() {
  const { syncCart } = useCart();
  const toast = useToast();

  const [cart, setCart] = useState(null); // { items, itemCount, total }
  const [loadError, setLoadError] = useState('');
  const [drafts, setDrafts] = useState({}); // bookId -> text in the quantity box
  const [rowErrors, setRowErrors] = useState({}); // bookId -> inline error
  const [busy, setBusy] = useState({}); // bookId -> true while saving

  // Put a fresh cart from the server on screen and update the header badge.
  const showCart = useCallback(
    (next) => {
      setCart(next);
      syncCart(next);
      setDrafts(Object.fromEntries(next.items.map((i) => [i.bookId, String(i.quantity)])));
    },
    [syncCart]
  );

  const load = useCallback(() => {
    setLoadError('');
    api('/cart')
      .then(showCart)
      .catch((err) => {
        setLoadError(err.message);
        toast.error(err.message);
      });
  }, [showCart, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setRowError = (bookId, message) =>
    setRowErrors(({ [bookId]: _old, ...rest }) => (message ? { ...rest, [bookId]: message } : rest));

  async function updateQuantity(item, rawValue) {
    const quantity = parseQuantity(rawValue);

    // 0, 11, -1, 2.5, "abc", empty -> inline error, nothing sent
    if (quantity === null) {
      setRowError(item.bookId, MSG.QUANTITY);
      return;
    }
    if (quantity === item.quantity) {
      setRowError(item.bookId, '');
      setDrafts((d) => ({ ...d, [item.bookId]: String(item.quantity) }));
      return;
    }

    setBusy((b) => ({ ...b, [item.bookId]: true }));
    try {
      const data = await api(`/cart/${item.bookId}`, { method: 'PUT', body: { quantity } });
      setRowError(item.bookId, '');
      showCart(data.cart);
      toast.success(data.message); // "Cart updated."
    } catch (err) {
      // 409 "Only {stock} copies available." / "Sorry, this book is out of stock."
      setRowError(item.bookId, err.message);
      toast.error(err.message);
      if (err.status === 409) setDrafts((d) => ({ ...d, [item.bookId]: String(item.quantity) }));
    } finally {
      setBusy((b) => ({ ...b, [item.bookId]: false }));
    }
  }

  async function removeItem(item) {
    setBusy((b) => ({ ...b, [item.bookId]: true }));
    try {
      const data = await api(`/cart/${item.bookId}`, { method: 'DELETE' });
      setRowError(item.bookId, '');
      showCart(data.cart);
      toast.success(data.message); // "{title}" was removed from your cart.
    } catch (err) {
      toast.error(err.message);
      setBusy((b) => ({ ...b, [item.bookId]: false }));
    }
  }

  function handleQtyKeyDown(e, item) {
    if (e.key === 'Enter') {
      e.preventDefault();
      updateQuantity(item, drafts[item.bookId]);
    }
  }

  // ---------- Render ----------

  if (loadError && !cart) {
    return (
      <section className="cart">
        <h1 className="page-title">Your cart</h1>
        <div className="banner banner--error banner--with-action cart__load-error">
          <span>{loadError}</span>
          <button type="button" className="btn btn--small" onClick={load}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!cart) {
    return (
      <section className="cart">
        <h1 className="page-title">Your cart</h1>
        <p className="results__status cart__loading">Loading your cart…</p>
      </section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <section className="cart">
        <h1 className="page-title">Your cart</h1>
        <div className="empty-state cart__empty" data-testid="cart-empty">
          <p className="empty-state__title">Your cart is empty.</p>
          <Link to="/" className="btn btn--primary">
            Browse books
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="cart">
      <div className="cart__head">
        <h1 className="page-title">Your cart</h1>
        <p className="page-lead">
          {cart.itemCount} item(s). Change a quantity or remove a book before you check out.
        </p>
      </div>

      <div className="cart__layout">
        <ul className="cart__items card" aria-label="Items in your cart">
          {cart.items.map((item) => {
            const draft = drafts[item.bookId] ?? String(item.quantity);
            const error = rowErrors[item.bookId];
            const isBusy = Boolean(busy[item.bookId]);
            const maxForBook = Math.min(MAX_QTY, item.stock);
            const level = stockLevel(item.stock);
            const qtyId = `qty-${item.bookId}`;

            return (
              <li key={item.bookId} className="cart-item" data-testid="cart-item">
                <div className="cart-item__cover" aria-hidden="true">
                  {item.title.charAt(0)}
                </div>

                <div className="cart-item__info">
                  <h2 className="cart-item__title">{item.title}</h2>
                  <p className="cart-item__author">by {item.author}</p>
                  <p className="cart-item__price">{formatPrice(item.price)} each</p>
                  {level !== 'in' && (
                    <p className={`cart-item__stock stock stock--${level}`}>
                      {level === 'out' ? 'Out of stock' : `Only ${item.stock} left`}
                    </p>
                  )}
                </div>

                <div className={`cart-item__qty${error ? ' field--error' : ''}`}>
                  <label htmlFor={qtyId} className="field__label">
                    Quantity
                  </label>
                  <div className="qty">
                    <button
                      type="button"
                      className="qty__btn"
                      onClick={() => updateQuantity(item, item.quantity - 1)}
                      disabled={isBusy || item.quantity <= 1}
                      aria-label={`Decrease quantity of ${item.title}`}
                    >
                      −
                    </button>
                    <input
                      id={qtyId}
                      className="qty__input field__input"
                      type="number"
                      inputMode="numeric"
                      value={draft}
                      onChange={(e) => {
                        setDrafts((d) => ({ ...d, [item.bookId]: e.target.value }));
                        if (error) setRowError(item.bookId, '');
                      }}
                      onBlur={() => updateQuantity(item, draft)}
                      onKeyDown={(e) => handleQtyKeyDown(e, item)}
                      disabled={isBusy}
                      aria-invalid={error ? 'true' : 'false'}
                      aria-describedby={error ? `${qtyId}-error` : undefined}
                    />
                    <button
                      type="button"
                      className="qty__btn"
                      onClick={() => updateQuantity(item, item.quantity + 1)}
                      disabled={isBusy || item.quantity >= maxForBook}
                      aria-label={`Increase quantity of ${item.title}`}
                    >
                      +
                    </button>
                  </div>
                  {error && (
                    <p id={`${qtyId}-error`} className="field__error" data-testid="qty-error">
                      {error}
                    </p>
                  )}
                </div>

                <div className="cart-item__end">
                  <p className="cart-item__subtotal" data-testid="line-subtotal">
                    {formatPrice(item.subtotal)}
                  </p>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => removeItem(item)}
                    disabled={isBusy}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="cart__summary card" aria-label="Order summary">
          <h2 className="cart__summary-title">Order summary</h2>
          <dl className="summary">
            <div className="summary__row">
              <dt>Items</dt>
              <dd data-testid="summary-count">{cart.itemCount}</dd>
            </div>
            <div className="summary__row summary__row--total">
              <dt>Total</dt>
              <dd data-testid="cart-total">{formatPrice(cart.total)}</dd>
            </div>
          </dl>
          <Link to="/checkout" className="btn btn--primary btn--block">
            Proceed to checkout
          </Link>
          <Link to="/" className="cart__continue">
            Continue shopping
          </Link>
        </aside>
      </div>
    </section>
  );
}
