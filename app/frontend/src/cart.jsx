// Shopping cart state shared by the header badge and the pages.
// The cart itself is stored on the server per user, so it survives logout/login;
// here we only keep the item count for the badge.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  // Load the count whenever someone logs in; reset it when they log out.
  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;
    api('/cart')
      .then((cart) => !cancelled && setCount(cart.itemCount))
      .catch(() => {}); // badge just stays at 0; the Cart page shows real errors
    return () => {
      cancelled = true;
    };
  }, [user]);

  // POST /api/cart. Returns { message, cart } or throws an ApiError, e.g.
  // 409 "Sorry, this book is out of stock." / "Only {stock} copies available."
  // 400 "Quantity must be between 1 and 10."
  const addToCart = useCallback(async (bookId, quantity = 1) => {
    const data = await api('/cart', { method: 'POST', body: { bookId, quantity } });
    setCount(data.cart.itemCount);
    return data;
  }, []);

  // For the Cart page: update the badge from any cart response.
  const syncCart = useCallback((cart) => setCount(cart.itemCount), []);

  const value = useMemo(() => ({ count, addToCart, syncCart }), [count, addToCart, syncCart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
