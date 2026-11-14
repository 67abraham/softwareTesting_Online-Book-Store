// Small fetch wrapper for the backend API.
// - Prefixes every path with /api (Vite proxies it to http://localhost:4000)
// - Attaches the JWT when the user is logged in
// - Turns every failure into an ApiError with { status, code, message, fields }

const TOKEN_KEY = 'bookstore_token';
export const GENERIC_ERROR = 'Something went wrong. Please try again.';

export class ApiError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    // true when the login session expired: AuthProvider has already shown the
    // "Your session has expired..." toast, so pages should not show another one.
    this.sessionExpired = false;
  }
}

// localStorage can throw (private mode, blocked storage), so every access is guarded.
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

// Called when a logged-in request comes back 401 (token expired or invalid).
// AuthProvider registers it so it can log the user out and show a message.
let onSessionExpired = null;
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Server down or no network
    throw new ApiError(0, 'NETWORK_ERROR', GENERIC_ERROR);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok) {
    const err = data && data.error;
    const code = err && err.code;
    const apiError = new ApiError(
      res.status,
      code || 'SERVER_ERROR',
      (err && err.message) || GENERIC_ERROR,
      (err && err.fields) || {}
    );
    if (res.status === 401 && token && (code === 'TOKEN_EXPIRED' || code === 'UNAUTHENTICATED') && onSessionExpired) {
      apiError.sessionExpired = true;
      onSessionExpired();
    }
    throw apiError;
  }
  return data;
}
