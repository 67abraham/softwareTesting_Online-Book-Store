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

## API tests (Postman)

`app/postman/OnlineBookStore.postman_collection.json` holds 64 API tests in 6 folders
(General, F1 Register and log in, F2 Search, F3 Cart, F4 Checkout, F5 Order history).
Every request checks the status code and the exact message the app shows.

```bash
cd app/backend && npm run seed && npm run dev            # API must be running on port 4000
npx newman run app/postman/OnlineBookStore.postman_collection.json
# or, with the Postman CLI:
postman collection run app/postman/OnlineBookStore.postman_collection.json
```

- Expected result on seeded data: 74 requests (64 tests + 10 setup calls), 180 assertions, 0 failures.
- The collection empties the cart it uses and registers a unique email each run, so it can be run again
  without reseeding, unless the data was changed by hand (for example an order placed as Bob).
- You can also import the file into the Postman app and use **Run collection**.
- The Postman CLI does not start on macOS 12 (`dyld: Symbol not found: __libcpp_verbose_abort`); use Newman there.
