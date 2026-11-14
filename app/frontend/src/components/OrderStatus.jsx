// Coloured badge for an order status: Placed, Shipped, Delivered or Cancelled.
export default function OrderStatus({ status }) {
  return (
    <span className={`order-status order-status--${String(status).toLowerCase()}`} data-testid="order-status">
      {status}
    </span>
  );
}
