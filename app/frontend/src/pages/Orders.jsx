// F5 - Order history (logged-in users only). Route: "/orders"
// The user's own orders, newest first: order number, date, items, total, status.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../components/Toast';
import OrderStatus from '../components/OrderStatus';
import { formatDate, formatPrice } from '../format';

export default function Orders() {
  const toast = useToast();
  const [orders, setOrders] = useState(null);
  const [emptyMessage, setEmptyMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoadError('');
    api('/orders')
      .then((data) => {
        setOrders(data.orders);
        setEmptyMessage(data.message || ''); // "You have not placed any orders yet."
      })
      .catch((err) => {
        if (err.sessionExpired) return; // already handled: toast shown, sent to Login
        setLoadError(err.message);
        toast.error(err.message);
      });
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="orders">
      <div className="orders__head">
        <h1 className="page-title">My orders</h1>
        <p className="page-lead">Your past orders, newest first. Select an order to see its details.</p>
      </div>

      {loadError && !orders && (
        <div className="banner banner--error banner--with-action">
          <span>{loadError}</span>
          <button type="button" className="btn btn--small" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {!orders && !loadError && <p className="results__status">Loading your orders…</p>}

      {orders && orders.length === 0 && (
        <div className="empty-state" data-testid="orders-empty">
          <p className="empty-state__title">{emptyMessage || 'You have not placed any orders yet.'}</p>
          <Link to="/" className="btn btn--primary">
            Start shopping
          </Link>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="card orders__list">
          {/* Column headings (hidden on phones, where each order is a small card) */}
          <div className="order-row order-row--head" aria-hidden="true">
            <span>Order number</span>
            <span>Date</span>
            <span>Items</span>
            <span>Total</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="orders__rows">
            {orders.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="order-row" data-testid="order-row">
                  <span className="order-row__number" data-testid="order-number">
                    {o.orderNo}
                  </span>
                  <span className="order-row__cell">
                    <span className="order-row__label">Date</span>
                    {formatDate(o.createdAt)}
                  </span>
                  <span className="order-row__cell">
                    <span className="order-row__label">Items</span>
                    {o.itemCount}
                  </span>
                  <span className="order-row__cell order-row__total">
                    <span className="order-row__label">Total</span>
                    {formatPrice(o.total)}
                  </span>
                  <span className="order-row__cell">
                    <OrderStatus status={o.status} />
                  </span>
                  <span className="order-row__view">View details →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
