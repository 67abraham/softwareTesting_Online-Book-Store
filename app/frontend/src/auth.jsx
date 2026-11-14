// Login session for the whole app.
// - Keeps the JWT in localStorage (via tokenStore) and the current user in state
// - Restores the user on page load with GET /api/auth/me
// - Logs the user out when the server says the session has expired
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, setSessionExpiredHandler, tokenStore } from './api';
import { useToast } from './components/Toast';
import { clearShippingDraft } from './checkoutDraft';

export const MSG_SESSION_EXPIRED = 'Your session has expired. Please log in again.';
export const MSG_LOGGED_OUT = 'You have been logged out.';

const AuthContext = createContext(null);

const currentPath = () => window.location.pathname + window.location.search;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // "ready" is false while we check a saved token, so the header doesn't flash "Log in".
  const [ready, setReady] = useState(() => !tokenStore.get());
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Why and where the user was just signed out: { reason: 'logout' | 'expired', at: '/cart' }.
  // ProtectedRoute reads it so it doesn't send the user to Login with the wrong
  // message (or at all, after a logout). Cleared on the next page change.
  const [signOut, setSignOut] = useState(null);
  useEffect(() => {
    setSignOut((s) => (s && s.at !== location.pathname + location.search ? null : s));
  }, [location.pathname, location.search]);

  // Session expired (401 on a logged-in request): clear it and tell the user.
  // Guests may stay on public pages; on a login-only page, ProtectedRoute
  // sends the user to Login and remembers the page to come back to.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      if (!tokenStore.get()) return; // already handled by an earlier request
      tokenStore.clear();
      setSignOut({ reason: 'expired', at: currentPath() });
      setUser(null);
      toast.error(MSG_SESSION_EXPIRED);
    });
    return () => setSessionExpiredHandler(null);
  }, [toast]);

  // On first load, turn a saved token back into a logged-in user.
  useEffect(() => {
    if (!tokenStore.get()) return;
    api('/auth/me')
      .then((data) => setUser(data.user))
      // Only a 401 means the token is bad. If the server is just unreachable,
      // keep the token so the user is still logged in on the next reload.
      .catch((err) => {
        if (err.status === 401) tokenStore.clear();
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    tokenStore.set(data.token);
    setSignOut(null);
    setUser(data.user);
    return data; // { message: "Welcome back, {name}!", token, user }
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    clearShippingDraft(); // don't leave an address behind on a shared computer
    setSignOut({ reason: 'logout', at: currentPath() });
    setUser(null);
    toast.success(MSG_LOGGED_OUT);
    navigate('/');
  }, [toast, navigate]);

  const value = useMemo(
    () => ({ user, ready, signOut, login, logout }),
    [user, ready, signOut, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
