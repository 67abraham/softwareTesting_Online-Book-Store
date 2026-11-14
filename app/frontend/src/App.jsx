// Root component: toasts, login session, cart badge, header and page routes.
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './auth';
import { CartProvider } from './cart';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';

// Temporary stand-in for pages that are not built yet.
function ComingSoon({ title }) {
  return (
    <section className="placeholder">
      <h1>{title}</h1>
      <p>This page is coming next.</p>
    </section>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Header />
            <main className="main">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login />} />

                {/* Logged-in users only (pages still to be built) */}
                <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
                <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                <Route path="/order-success" element={<ProtectedRoute><OrderSuccess /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><ComingSoon title="My orders" /></ProtectedRoute>} />
                <Route path="/orders/:id" element={<ProtectedRoute><ComingSoon title="Order details" /></ProtectedRoute>} />

                <Route path="*" element={<ComingSoon title="Page not found" />} />
              </Routes>
            </main>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
