// F5 - One order's details (logged-in users only). Route: "/orders/:id"
// Items with quantities and unit prices, shipping address and total.
// Another user's order (or an id that doesn't exist) returns 404 "Order not found."
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../components/Toast';
import OrderStatus from '../components/OrderStatus';
import { formatDateTime, formatPrice } from '../format';

export default function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [notFound, setNotFound] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setOrder(null);
    setNotFound('');
    setLoadError('');
    api(`/orders/${encodeURIComponent(id)}`)
      .then((data) => setOrder(data.order))
      .catch((err) => {
        if (err.sessionExpired) return; // already handled: toast shown, sent to Login
        if (err.status === 404) {
          setNotFound(err.message); // "Order not found."
          return;
        }
        setLoadError(err.message);
        toast.error(err.message);
      });
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const backLink = (
    <Link to="/orders" className="back-link">
      ← Back to my orders
    </Link>
  );

  if (notFound) {
    return (
      <section className="order-detail">
        {backLink}
        <div className="empty-state order-detail__notice" data-testid="order-not-found">
          <p className="empty-state__title">{notFound}</p>
          <Link to="/orders" className="btn btn--primary">
            View my orders
          </Link>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="order-detail">
        {backLink}
        <div className="banner banner--error banner--with-action order-detail__notice">
          <span>{loadError}</span>
          <button type="button" className="btn btn--small" onClick={load}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="order-detail">
        {backLink}
        <p className="results__status order-detail__notice">Loading order…</p>
      </section>
    );
  }

  const s = order.shipping;

  return (
    <section className="order-detail">
      {backLink}

      <div className="order-detail__head">
        <div>
          <h1 className="page-title" data-testid="detail-order-number">
            Order {order.orderNo}
          </h1>
          <p className="page-lead">Placed on {formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatus status={order.status} />
      </div>

      <div className="order-detail__layout">
        <div className="card order-detail__items">
          <h2 className="order-detail__section-title">Items</h2>
          <table className="items-table">
            <thead>
              <tr>
                <th scope="col">Book</th>
                <th scope="col" className="num">
                  Unit price
                </th>
                <th scope="col" className="num">
                  Qty
                </th>
                <th scope="col" className="num">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.bookId} data-testid="detail-item">
                  <td>{item.title}</td>
                  <td className="num">{formatPrice(item.unitPrice)}</td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{formatPrice(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3}>
                  Total ({order.itemCount} item(s))
                </th>
                <td className="num" data-testid="detail-total">
                  {formatPrice(order.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <aside className="card order-detail__shipping" aria-label="Shipping address">
          <h2 className="order-detail__section-title">Shipping address</h2>
          <address className="order-detail__address" data-testid="detail-address">
            {s.fullName}
            <br />
            {s.address}
            <br />
            {s.city} {s.postalCode}
            <br />
            {s.phone}
          </address>
        </aside>
      </div>
    </section>
  );
}
