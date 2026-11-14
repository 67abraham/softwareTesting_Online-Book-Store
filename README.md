# Online Book Store System

A simple web application built for a Software Testing course assignment (System Test Plan).

- `app/backend`: Node.js + Express REST API with SQLite
- `app/frontend`: React 18 + Vite user interface

## Run

```bash
cd app/backend  && npm install && npm run seed && npm run dev   # API on http://localhost:4000
cd app/frontend && npm install && npm run dev                   # UI  on http://localhost:5173
```

Demo users: `alice@example.com` and `bob@example.com` (password `Password123`).

## Login lockout (note for testing)

After **5 failed logins** for the same email from the same IP within 15 minutes, the API returns
**429** `Too many failed login attempts. Please try again in 15 minutes.` until the window passes.
A successful login resets the counter.

- The counter lives in memory: **restarting the backend clears it** (`npm run seed` does not).
- Postman runs and screenshot scripts should use at most 4 wrong-password attempts per email,
  or restart the backend before each run.
- To change the limits: `LOGIN_MAX_FAILURES=10 LOGIN_LOCK_MINUTES=1 npm run dev`.
