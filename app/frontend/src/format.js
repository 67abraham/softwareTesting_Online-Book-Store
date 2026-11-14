// Display helpers shared by pages.

// 14.5 -> "$14.50"
export function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

// The database stores times in UTC as "2026-09-12 10:15:00".
function parseDbDate(value) {
  return new Date(String(value).replace(' ', 'T') + 'Z');
}

// "2026-09-12 10:15:00" -> "Sep 12, 2026"
export function formatDate(value) {
  return parseDbDate(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// "2026-09-12 10:15:00" -> "Sep 12, 2026, 10:15 AM" (in the viewer's time zone)
export function formatDateTime(value) {
  return parseDbDate(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Stock level used for the badge colour. The badge text ("In stock",
// "Only N left", "Out of stock") comes from the server.
export function stockLevel(stock) {
  if (stock <= 0) return 'out';
  if (stock <= 3) return 'low';
  return 'in';
}
