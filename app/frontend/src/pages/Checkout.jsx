// F4 - Checkout (logged-in users only). Route: "/checkout"
// Shipping details + mock payment. The server re-checks stock, works out the
// total itself, creates the order and empties the cart.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useCart } from '../cart';
import { useToast } from '../components/Toast';
import FormField from '../components/FormField';
import { formatPrice } from '../format';
import {
  CARD_DIGITS,
  NUMERIC_FIELDS,
  PAYMENT_FIELDS,
  SHIPPING_FIELDS,
  formatCardNumber,
  toHalfWidth,
  validateCheckout,
} from '../validation';
import { clearShippingDraft, loadShippingDraft, saveShippingDraft } from '../checkoutDraft';

const MSG_EMPTY_CART = 'Your cart is empty. Add books before checking out.';
const MSG_SELECTION_GONE = 'The books you selected are no longer in your cart.';

// "/checkout?books=3,8" -> [3, 8] (the books ticked on the Cart page).
// No list -> null, meaning "order the whole cart" (the original behaviour).
function parseSelection(value) {
  if (!value) return null;
  const ids = [...new Set(value.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  return ids.length > 0 ? ids : null;
}

// The part of the cart being ordered: the selected books, or the whole cart.
function orderView(cart, selectedIds) {
  if (!selectedIds) return cart;
  const wanted = new Set(selectedIds);
  const items = cart.items.filter((i) => wanted.has(i.bookId));
  return {
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    total: Math.round(items.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100,
  };
}
const MSG_CART_CHANGED = 'Your cart has changed. Please check the order summary and place your order again.';

// Items whose quantity is more than the stock left, with the same message the
// server uses for this case (409 STOCK_CHANGED).
function stockProblems(cart) {
  return cart.items
    .filter((i) => i.quantity > i.stock)
    .map((i) => ({
      bookId: i.bookId,
      text: `"${i.title}" has only ${i.stock} copies left. Please update your cart.`,
    }));
}

// Index in "4242 4242 4242 4242" just after the n-th digit (0 -> start of the box).
function positionAfterDigits(formatted, n) {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === n) return i + 1;
  }
  return formatted.length;
}

// A short "fingerprint" of the cart, used to notice if it changed (items, quantities, prices).
const cartFingerprint = (cart) =>
  `${cart.items.map((i) => `${i.bookId}:${i.quantity}:${i.price}`).join(',')}|${cart.total}`;

export default function Checkout() {
  const { user } = useAuth();
  const { syncCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const [cart, setCart] = useState(null);
  const [loadError, setLoadError] = useState('');
  // Shipping details come back from this tab's saved draft (e.g. after the
  // session expired and the user logged in again); card fields always start empty.
  const [values, setValues] = useState(() => {
    const draft = loadShippingDraft(user.id) || {};
    return {
      fullName: draft.fullName ?? user.name,
      address: draft.address ?? '',
      city: draft.city ?? '',
      postalCode: draft.postalCode ?? '',
      phone: draft.phone ?? '',
      cardNumber: '',
      expiry: '',
      cvv: '',
    };
  });
  const [errors, setErrors] = useState({});
  // Problem with the order as a whole (payment declined, stock changed, ...)
  const [banner, setBanner] = useState(null); // { text, cartLink }
  const [submitting, setSubmitting] = useState(false);

  // Books ticked on the Cart page ("/checkout?books=3,8"); null = whole cart.
  const [searchParams] = useSearchParams();
  const selectedIds = useMemo(() => parseSelection(searchParams.get('books')), [searchParams]);
  // The part of the cart being ordered (null until the cart has loaded).
  const view = cart ? orderView(cart, selectedIds) : null;

  const loadCart = useCallback(() => {
    setLoadError('');
    return api('/cart')
      .then((data) => {
        setCart(data);
        syncCart(data);
      })
      .catch((err) => {
        if (err.sessionExpired) return; // already handled: toast shown, sent to Login
        setLoadError(err.message);
        toast.error(err.message);
      });
  }, [syncCart, toast]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Quietly reload the summary when the user comes back to this tab, so the
  // total stays right if the cart was changed in another tab.
  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== 'visible' || submitting) return;
      api('/cart')
        .then((data) => {
          setCart(data);
          syncCart(data);
        })
        .catch(() => {}); // a background refresh failing is not worth a message
    }
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [submitting, syncCart]);

  // Save the shipping details as they are typed (only shipping, never card details).
  const { fullName, address, city, postalCode, phone } = values;
  useEffect(() => {
    saveShippingDraft(user.id, { fullName, address, city, postalCode, phone });
  }, [user.id, fullName, address, city, postalCode, phone]);

  function handleChange(e) {
    const { name } = e.target;
    // Number fields: full-width "４２４２" from an input method becomes "4242".
    const value = NUMERIC_FIELDS.includes(name) ? toHalfWidth(e.target.value) : e.target.value;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors(({ [name]: _removed, ...rest }) => rest);
  }

  // Card number: digits only, up to the standard 16, shown in groups of four.
  // Reformatting replaces the whole value, which would throw the cursor to the
  // end, so we count the digits before the cursor and put it back after the
  // same number of digits.
  function handleCardNumberChange(e) {
    const input = e.target;
    // Full-width digits ("４２４２") from an input method count as digits too.
    // (Full-width characters convert one-to-one, so the cursor position still matches.)
    const raw = toHalfWidth(input.value);
    const caret = input.selectionStart ?? raw.length;
    const inputType = e.nativeEvent.inputType;

    let digits = raw.replace(/\D/g, '');
    let digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, '').length;

    // Backspace / Delete on the space between groups removed only the space,
    // which formatting would put straight back. Remove the neighbouring digit instead.
    const onlyASpaceWasDeleted = digits === values.cardNumber.replace(/\D/g, '');
    if (onlyASpaceWasDeleted && inputType === 'deleteContentBackward' && digitsBeforeCaret > 0) {
      digits = digits.slice(0, digitsBeforeCaret - 1) + digits.slice(digitsBeforeCaret);
      digitsBeforeCaret -= 1;
    } else if (onlyASpaceWasDeleted && inputType === 'deleteContentForward') {
      digits = digits.slice(0, digitsBeforeCaret) + digits.slice(digitsBeforeCaret + 1);
    }

    const formatted = formatCardNumber(digits);
    const caretPosition = positionAfterDigits(formatted, Math.min(digitsBeforeCaret, CARD_DIGITS));

    setValues((v) => ({ ...v, cardNumber: formatted }));
    if (errors.cardNumber) setErrors(({ cardNumber: _removed, ...rest }) => rest);

    // Runs after React has put the new value in the box.
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.setSelectionRange(caretPosition, caretPosition);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner(null);

    // 1. Check the form in the browser (same rules as the server).
    const fieldErrors = validateCheckout(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      document.getElementById(Object.keys(fieldErrors)[0])?.focus();
      return;
    }

    setSubmitting(true);

    // 2. Reload the cart, so the user never pays a total they have not seen.
    let fresh;
    try {
      fresh = await api('/cart');
    } catch (err) {
      setSubmitting(false);
      if (err.sessionExpired) return;
      toast.error(err.message);
      setBanner({ text: err.message, cartLink: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCart(fresh);
    syncCart(fresh);
    const freshView = orderView(fresh, selectedIds);
    if (freshView.items.length === 0 || stockProblems(freshView).length > 0) {
      // The empty-cart message, "selected books are no longer in your cart" or the
      // stock warning is now on screen.
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (cartFingerprint(freshView) !== cartFingerprint(view)) {
      setSubmitting(false);
      toast.error(MSG_CART_CHANGED);
      setBanner({ text: MSG_CART_CHANGED, cartLink: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 3. Send the order. The total is calculated on the server, not sent from here.
    const pick = (keys) => Object.fromEntries(keys.map((k) => [k, values[k].trim()]));
    try {
      const data = await api('/orders', {
        method: 'POST',
        body: {
          shipping: pick(SHIPPING_FIELDS),
          payment: pick(PAYMENT_FIELDS),
          // Only when books were ticked on the Cart page; otherwise the whole cart is ordered.
          ...(selectedIds ? { bookIds: freshView.items.map((i) => i.bookId) } : {}),
        },
      });
      // What is left in the cart: the books that were not selected (or nothing).
      syncCart(data.cart || { itemCount: 0 });
      clearShippingDraft();
      toast.success(data.message); // "Order placed successfully! Your order number is ORD-..."
      // userId lets the confirmation page check the order belongs to whoever is viewing it.
      navigate('/order-success', {
        replace: true,
        state: { order: data.order, message: data.message, userId: user.id },
      });
    } catch (err) {
      setSubmitting(false);
      // Session expired: the toast is already shown and ProtectedRoute sends the
      // user to Login; the shipping details are saved for when they come back.
      if (err.sessionExpired) return;
      toast.error(err.message);

      if (err.code === 'VALIDATION_ERROR') {
        // Server found field problems the browser missed: show them inline.
        setErrors(err.fields || {});
      } else if (err.code === 'STOCK_CHANGED') {
        // '"{title}" has only {stock} copies left. Please update your cart.'
        setBanner({ text: err.message, cartLink: true });
        loadCart();
      } else if (err.code === 'SELECTION_INVALID') {
        // A selected book left the cart in the moment before ordering (e.g. another tab).
        setBanner({ text: err.message, cartLink: true });
        loadCart();
      } else if (err.code === 'EMPTY_CART') {
        loadCart(); // shows the empty-cart message
      } else {
        // 402 "Payment declined. Please use a different card." or a network error
        setBanner({ text: err.message, cartLink: false });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ---------- Render ----------

  if (loadError && !cart) {
    return (
      <section className="checkout">
        <h1 className="page-title">Checkout</h1>
        <div className="banner banner--error banner--with-action checkout__notice">
          <span>{loadError}</span>
          <button type="button" className="btn btn--small" onClick={loadCart}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!cart) {
    return (
      <section className="checkout">
        <h1 className="page-title">Checkout</h1>
        <p className="results__status checkout__notice">Loading checkout…</p>
      </section>
    );
  }

  // Checkout is blocked when the cart is empty.
  if (cart.items.length === 0) {
    return (
      <section className="checkout">
        <h1 className="page-title">Checkout</h1>
        <div className="empty-state checkout__notice" data-testid="checkout-empty">
          <p className="empty-state__title">{MSG_EMPTY_CART}</p>
          <Link to="/" className="btn btn--primary">
            Browse books
          </Link>
        </div>
      </section>
    );
  }

  // Books were ticked on the Cart page, but none of them are in the cart any more.
  if (selectedIds && view.items.length === 0) {
    return (
      <section className="checkout">
        <h1 className="page-title">Checkout</h1>
        <div className="empty-state checkout__notice" data-testid="selection-gone">
          <p className="empty-state__title">{MSG_SELECTION_GONE}</p>
          <Link to="/cart" className="btn btn--primary">
            Back to cart
          </Link>
        </div>
      </section>
    );
  }

  const problems = stockProblems(view);
  const lowStock = new Set(problems.map((p) => p.bookId));
  const partialOrder = Boolean(selectedIds) && view.items.length < cart.items.length;

  const field = (id, label, props = {}) => (
    <FormField id={id} label={label} value={values[id]} onChange={handleChange} error={errors[id]} {...props} />
  );

  return (
    <section className="checkout">
      <div className="checkout__head">
        <h1 className="page-title">Checkout</h1>
        <p className="page-lead">Enter your shipping and payment details to place your order.</p>
      </div>

      {partialOrder && (
        <div className="banner banner--info banner--with-action" data-testid="partial-order-note">
          <span>
            You are ordering {view.items.length} of the {cart.items.length} books in your cart. The other books
            stay in your cart.
          </span>
          <Link to="/cart" className="btn btn--small">
            Change selection
          </Link>
        </div>
      )}

      {banner && (
        <div className="banner banner--error banner--with-action" data-testid="checkout-banner">
          <span>{banner.text}</span>
          {banner.cartLink && (
            <Link to="/cart" className="btn btn--small">
              Update cart
            </Link>
          )}
        </div>
      )}

      {/* Some items are over the stock left: fix the cart before filling the form. */}
      {problems.length > 0 && (
        <div className="banner banner--error banner--with-action" data-testid="stock-warning">
          <ul className="checkout__problems">
            {problems.map((p) => (
              <li key={p.bookId}>{p.text}</li>
            ))}
          </ul>
          <Link to="/cart" className="btn btn--small">
            Update cart
          </Link>
        </div>
      )}

      <div className="checkout__layout">
        <form className="checkout__form" onSubmit={handleSubmit} noValidate>
          <fieldset className="card checkout__section">
            <legend className="checkout__legend">Shipping address</legend>
            <div className="form-grid">
              <div className="form-grid__full">{field('fullName', 'Full name', { autoComplete: 'name' })}</div>
              <div className="form-grid__full">{field('address', 'Address', { autoComplete: 'street-address' })}</div>
              {field('city', 'City', { autoComplete: 'address-level2' })}
              {field('postalCode', 'Postal code', { autoComplete: 'postal-code', inputMode: 'numeric', hint: '4 to 10 digits' })}
              <div className="form-grid__full">
                {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel', hint: '7 to 15 digits, may start with +' })}
              </div>
            </div>
          </fieldset>

          <fieldset className="card checkout__section">
            <legend className="checkout__legend">Payment</legend>
            <p className="checkout__demo-note" data-testid="test-cards">
              Demo shop, no real payment is taken. Test cards: <strong>4242 4242 4242 4242</strong> (approved),{' '}
              {/* <strong>4000 0000 0000 0002</strong> (declined). */}
            </p>
            <div className="form-grid">
              <div className="form-grid__full">
                {field('cardNumber', 'Card number', {
                  inputMode: 'numeric',
                  autoComplete: 'cc-number',
                  placeholder: '4242 4242 4242 4242',
                  hint: `${CARD_DIGITS} digits`,
                  onChange: handleCardNumberChange,
                })}
              </div>
              {field('expiry', 'Expiry (MM/YY)', { autoComplete: 'cc-exp', placeholder: 'MM/YY' })}
              {field('cvv', 'CVV', { inputMode: 'numeric', autoComplete: 'cc-csc', placeholder: '123' })}
            </div>
          </fieldset>

          <button
            type="submit"
            className="btn btn--primary btn--block checkout__submit"
            disabled={submitting || problems.length > 0}
          >
            {submitting ? 'Placing order…' : `Place order · ${formatPrice(view.total)}`}
          </button>
          {problems.length > 0 && (
            <p className="checkout__submit-note">Update your cart to continue.</p>
          )}
        </form>

        <aside className="cart__summary card" aria-label="Order summary">
          <h2 className="cart__summary-title">Order summary</h2>
          <ul className="checkout__lines">
            {view.items.map((item) => (
              <li key={item.bookId} className="checkout__line" data-testid="checkout-line">
                <span className="checkout__line-title">
                  {item.title} <span className="checkout__line-qty">× {item.quantity}</span>
                  {lowStock.has(item.bookId) && (
                    <span className="checkout__line-warning">Only {item.stock} left</span>
                  )}
                </span>
                <span>{formatPrice(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="summary">
            <div className="summary__row">
              <dt>Items</dt>
              <dd>{view.itemCount}</dd>
            </div>
            <div className="summary__row summary__row--total">
              <dt>Total</dt>
              <dd data-testid="checkout-total">{formatPrice(view.total)}</dd>
            </div>
          </dl>
          <Link to="/cart" className="cart__continue">
            Edit cart
          </Link>
        </aside>
      </div>
    </section>
  );
}
