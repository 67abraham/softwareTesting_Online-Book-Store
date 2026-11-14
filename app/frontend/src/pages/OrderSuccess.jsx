// F4 - Order confirmation, shown right after a successful checkout.
// Route: "/order-success" (the order is passed in from the Checkout page).
import { Link, Navigate, useLocation } from 'react-router-dom';
import { formatPrice } from '../format';
import { useAuth } from '../auth';

export default function OrderSuccess() {
  const { state } = useLocation();
  const { user } = useAuth();

  // Show the order list instead when:
  // - the page was opened directly (no order details passed in), or
  // - the order belongs to someone else, e.g. another user logged in on the same
  //   browser tab and went Back through the history.
  if (!state || !state.order || !user || state.userId !== user.id) {
    return <Navigate to="/orders" replace />;
  }

  const { order, message } = state;
  // Show the server's message as-is, but keep the order number on one line.
  const [before, after = ''] = message.split(order.orderNo);

  return (
    <section className="success">
      <div className="card success__card">
        <div className="success__icon" aria-hidden="true">
          ✓
        </div>
        <h1 className="page-title">Thank you for your order</h1>
        <p className="success__message" role="status" data-testid="order-success-message">
          {before}
          <span className="nowrap">{order.orderNo}</span>
          {after}
        </p>

        <dl className="success__details">
          <div>
            <dt>Order number</dt>
            <dd data-testid="order-number">{order.orderNo}</dd>
          </div>
          <div>
            <dt>Items</dt>
            <dd>{order.itemCount}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatPrice(order.total)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{order.status}</dd>
          </div>
        </dl>

        <div className="success__actions">
          <Link to={`/orders/${order.id}`} className="btn btn--primary">
            View order
          </Link>
          <Link to="/" className="btn btn--ghost">
            Continue shopping
          </Link>
        </div>
      </div>
    </section>
  );
}
