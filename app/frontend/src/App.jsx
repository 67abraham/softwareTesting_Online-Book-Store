// Root component: toasts, header and page routes.
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Header from './components/Header';
import Register from './pages/Register';

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
        <Header />
        <main className="main">
          <Routes>
            <Route path="/" element={<ComingSoon title="Browse books" />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<ComingSoon title="Log in" />} />
            <Route path="*" element={<ComingSoon title="Page not found" />} />
          </Routes>
        </main>
      </ToastProvider>
    </BrowserRouter>
  );
}
