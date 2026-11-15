// Captures the 20 report screenshots into report/images/.
//
// Before running: start the backend (port 4000) and the frontend (port 5173).
//   cd app/scripts && npm install && npm run screenshots
//
// The script reseeds the database first (known data), drives the running app
// in headless Chrome at 1280x800, and reseeds again at the end so the app is
// left in its demo state.
//
// Settings (optional environment variables):
//   APP_URL      default http://localhost:5173
//   CHROME_PATH  default /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BACKEND = path.join(ROOT, 'app', 'backend');
const OUT = path.join(ROOT, 'report', 'images');
const APP = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const saved = [];

// ---------- setup ----------

function reseed() {
  execSync('npm run seed --silent', { cwd: BACKEND, stdio: 'ignore' });
}

async function checkAppIsRunning() {
  try {
    const res = await fetch(`${APP}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(`The app is not reachable at ${APP} (${err.message}).`);
    console.error('Start the backend (app/backend: npm run dev) and frontend (app/frontend: npm run dev) first.');
    process.exit(1);
  }
}

// Direct API call (through the Vite proxy), used to prepare data quickly.
async function api(method, url, body, token) {
  const res = await fetch(`${APP}/api${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ---------- page helpers ----------

let page;

async function go(url) {
  await page.goto(APP + url, { waitUntil: 'networkidle0' });
  await sleep(200);
}

async function dismissToasts() {
  await page.$$eval('.toast__close', (buttons) => buttons.forEach((b) => b.click()));
  await sleep(150);
}

async function type(selector, text) {
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  if (text) await page.type(selector, text);
}

async function fill(values) {
  for (const [id, text] of Object.entries(values)) await type(`#${id}`, text);
}

async function submit() {
  await dismissToasts();
  await page.click('button[type=submit]');
}

async function waitFor(selector) {
  await page.waitForSelector(selector, { visible: true, timeout: 8000 });
  await sleep(450); // let the toast slide-in animation finish
}

// Clicks the "Add to cart" button on the card with this title.
async function clickAddToCart(title) {
  await dismissToasts();
  await page.evaluate((t) => {
    const card = [...document.querySelectorAll('[data-testid=book-card]')].find(
      (c) => c.querySelector('.book-card__title').textContent === t
    );
    card.querySelector('.book-card__add').click();
  }, title);
}

async function login(email, password = 'Password123') {
  await go('/login');
  await page.waitForSelector('#email', { visible: true, timeout: 8000 });
  await fill({ email, password });
  await submit();
  await page.waitForSelector('[data-testid=header-user]', { timeout: 8000 });
  await sleep(300);
}

async function logout() {
  await page.waitForSelector('xpath/.//button[contains(., "Log out")]', { timeout: 8000 });
  const [button] = await page.$$('xpath/.//button[contains(., "Log out")]');
  await button.click();
  // Wait until the header really shows the guest links, not a fixed delay.
  await page.waitForSelector('a.nav__link[href="/login"]', { timeout: 8000 });
  await sleep(200);
  await dismissToasts();
}

// Saves report/images/<name>.png.
// options.clip: CSS selector to crop to (with padding); options.fullPage: whole page.
async function shot(name, options = {}) {
  await page.mouse.move(1, 799); // no hover effects in the picture
  await sleep(150);
  const file = path.join(OUT, `${name}.png`);
  const settings = { path: file };
  if (options.fullPage) settings.fullPage = true;
  if (options.clip) {
    const box = await page.$eval(options.clip, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
    });
    const pad = options.padding ?? 24;
    settings.clip = {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(1280, box.width + pad * 2),
      height: box.height + pad * 2,
    };
    settings.captureBeyondViewport = true;
  }
  await page.screenshot(settings);
  saved.push(name);
  console.log(`  saved ${name}.png`);
}

// ---------- the screenshots ----------

async function guestScreens() {
  console.log('Search (F2) and guest cart (F3):');
  await go('/');
  await type('#search', 'the');
  await page.click('button[type=submit]');
  await waitFor('[data-testid=results-count]');
  await shot('f2-search-results');

  await go('/');
  await page.select('#category', 'Science');
  await waitFor('[data-testid=results-count]');
  await shot('f2-category-filter');

  await go('/');
  await type('#search', 'zzz');
  await page.click('button[type=submit]');
  await waitFor('[data-testid=no-results]');
  await shot('f2-no-results');

  // "The Silent Harbor" (Fiction) has stock 0: badge + disabled button.
  await go('/?category=Fiction');
  await shot('f3-out-of-stock');

  // A guest clicking "Add to cart" is sent to Login with a message.
  await go('/?category=Fiction');
  await clickAddToCart('A Winter in Lisbon');
  await waitFor('[data-testid=login-notice]');
  await shot('f3-guest-add-blocked');
}

async function accountScreens() {
  console.log('Register and log in (F1):');
  await go('/register');
  await fill({ name: 'Test User', email: 'test@', password: 'abc', confirmPassword: 'abd' });
  await submit();
  await waitFor('.field__error');
  await shot('f1-register-validation-error', { clip: '.auth__card' });

  await go('/register');
  await fill({ name: 'Alice Johnson', email: 'alice@example.com', password: 'Password123', confirmPassword: 'Password123' });
  await submit();
  await waitFor('.toast--error');
  await shot('f1-register-duplicate-email');

  await go('/register');
  await fill({ name: 'Carol Tester', email: 'carol@example.com', password: 'Password123', confirmPassword: 'Password123' });
  await submit();
  await waitFor('.toast--success');
  await shot('f1-register-success');

  await go('/login');
  await fill({ email: 'alice@example.com', password: 'WrongPass1' }); // 1 failed attempt (lockout is at 5)
  await submit();
  await waitFor('.toast--error');
  await shot('f1-login-invalid');

  await go('/login');
  await fill({ email: 'alice@example.com', password: 'Password123' });
  await submit();
  await waitFor('.toast--success');
  await page.waitForSelector('[data-testid=header-user]');
  await shot('f1-login-success');
}

async function shoppingScreens() {
  console.log('Cart (F3), checkout (F4) and orders (F5) as Alice:');
  // Alice is logged in from the previous step.
  await go('/');
  await clickAddToCart('A Winter in Lisbon');
  await waitFor('.toast--success');
  await shot('f3-add-to-cart-success');

  // Two more books so the cart page shows several lines and a low-stock note.
  const { token } = await api('POST', '/auth/login', { email: 'alice@example.com', password: 'Password123' });
  await api('POST', '/cart', { bookId: 11, quantity: 1 }, token); // Empires of Sand (only 2 left)
  await api('POST', '/cart', { bookId: 29, quantity: 2 }, token); // Money Matters
  await go('/cart');
  await shot('f3-cart-page');

  // Typing 11 copies: inline "Quantity must be between 1 and 10."
  await type('#qty-4', '11');
  await page.keyboard.press('Enter');
  await waitFor('[data-testid=qty-error]');
  await shot('f3-quantity-limit');

  await go('/checkout');
  await fill({
    address: '',
    city: 'Springfield',
    postalCode: '12',
    phone: 'abc',
    cardNumber: '4242 4242',
    expiry: '13/30',
    cvv: '12',
  });
  await submit();
  await waitFor('.field__error');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('f4-checkout-validation', { fullPage: true });

  await go('/checkout');
  const valid = { address: '12 Maple Street', city: 'Springfield', postalCode: '12345', phone: '+1 555 010 1234', expiry: '12/30', cvv: '123' };
  await fill({ ...valid, cardNumber: '4000 0000 0000 0002' });
  await submit();
  await waitFor('[data-testid=checkout-banner]');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('f4-payment-declined');

  await type('#cardNumber', '4242 4242 4242 4242');
  await submit();
  await waitFor('[data-testid=order-number]');
  await shot('f4-order-success');

  await go('/orders');
  await page.waitForSelector('[data-testid=order-row]');
  await dismissToasts();
  await shot('f5-order-history');

  await go('/orders/1'); // seeded order ORD-20260912-0001 (Delivered)
  await page.waitForSelector('[data-testid=detail-item]');
  await shot('f5-order-detail');

  await logout();
}

async function emptyStateScreens() {
  console.log('Empty states as Bob (F4, F5):');
  await login('bob@example.com');
  await dismissToasts();
  await go('/checkout');
  await page.waitForSelector('[data-testid=checkout-empty]');
  await shot('f4-empty-cart-blocked');

  await go('/orders');
  await page.waitForSelector('[data-testid=orders-empty]');
  await shot('f5-empty-history');
  await logout();
}

// ---------- run ----------

await checkAppIsRunning();
fs.mkdirSync(OUT, { recursive: true });
console.log('Reseeding the database...');
reseed();

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
try {
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await guestScreens();
  await accountScreens();
  await shoppingScreens();
  await emptyStateScreens();
} catch (err) {
  console.error(`\nStopped: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  reseed(); // leave the app with the known demo data
}

console.log(`\n${saved.length} of 20 screenshots saved to ${path.relative(ROOT, OUT)}/`);
if (saved.length !== 20) process.exitCode = 1;
