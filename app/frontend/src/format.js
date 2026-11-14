// Display helpers shared by pages.

// 14.5 -> "$14.50"
export function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

// Stock level used for the badge colour. The badge text ("In stock",
// "Only N left", "Out of stock") comes from the server.
export function stockLevel(stock) {
  if (stock <= 0) return 'out';
  if (stock <= 3) return 'low';
  return 'in';
}
