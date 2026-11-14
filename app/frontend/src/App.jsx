// Root component: toasts, login session, header and page routes.
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './auth';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Register from './pages/Register';
import Login from './pages/Login';

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
          <Header />
          <main className="main">
            <Routes>
              <Route path="/" element={<ComingSoon title="Browse books" />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />

              {/* Logged-in users only (pages still to be built) */}
              <Route path="/cart" element={<ProtectedRoute><ComingSoon title="Your cart" /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><ComingSoon title="Checkout" /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><ComingSoon title="My orders" /></ProtectedRoute>} />
              <Route path="/orders/:id" element={<ProtectedRoute><ComingSoon title="Order details" /></ProtectedRoute>} />

              <Route path="*" element={<ComingSoon title="Page not found" />} />
            </Routes>
          </main>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
