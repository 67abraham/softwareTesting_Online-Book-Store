// Keeps the shipping details typed on the Checkout page for the current
// browser tab (sessionStorage), so they survive a re-login after the session
// expires. Card details are never saved. Each draft belongs to one user.
import { SHIPPING_FIELDS } from './validation';

const KEY = 'bookstore_checkout_shipping';

export function loadShippingDraft(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY));
    return saved && saved.userId === userId ? saved.shipping : null;
  } catch {
    return null; // storage blocked or bad data: start with an empty form
  }
}

export function saveShippingDraft(userId, values) {
  try {
    const shipping = Object.fromEntries(SHIPPING_FIELDS.map((k) => [k, values[k]]));
    sessionStorage.setItem(KEY, JSON.stringify({ userId, shipping }));
  } catch {
    /* ignore */
  }
}

export function clearShippingDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
