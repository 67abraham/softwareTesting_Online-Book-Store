// F1 - Login page
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { validateLogin } from '../validation';
import { useToast } from '../components/Toast';
import FormField from '../components/FormField';

// Where to go after logging in. Only in-app paths like "/cart" are allowed,
// and never back to the login or register pages.
function safeReturnPath(from) {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/';
  if (from === '/login' || from === '/register') return '/';
  return from;
}

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, ready, login } = useAuth();
  const toast = useToast();

  // One-time values passed in by other pages (read once, on first render):
  // - Register:        { email }               -> email is pre-filled
  // - Protected page:  { message, from }       -> "Please log in to continue." + return path
  const [initial] = useState(() => location.state || {});
  const returnTo = safeReturnPath(initial.from);

  const [values, setValues] = useState({ email: initial.email || '', password: '' });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(initial.message || null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Clear the passed-in values from browser history, so a page refresh
    // doesn't show the notice again or reuse an old return path.
    if (location.state) navigate(location.pathname, { replace: true, state: null });
    // Coming from Register the email is already filled in, so start in the password field.
    if (initial.email) document.getElementById('password')?.focus();
    // Runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Already logged in: nothing to do here. (Skipped while submitting, so the
  // redirect after a successful login goes to the return path.)
  if (ready && user && !submitting) return <Navigate to={returnTo} replace />;

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors(({ [name]: _removed, ...rest }) => rest);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const fieldErrors = validateLogin(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      document.getElementById(Object.keys(fieldErrors)[0])?.focus();
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const data = await login(values.email.trim(), values.password);
      toast.success(data.message); // "Welcome back, {name}!"
      navigate(returnTo, { replace: true });
    } catch (err) {
      // 401 "Invalid email or password.", 429 too many attempts, or a network error.
      setErrors(err.fields || {});
      toast.error(err.message);
      setValues((v) => ({ ...v, password: '' }));
      setSubmitting(false);
      document.getElementById('password')?.focus();
    }
  }

  return (
    <section className="auth">
      <div className="card auth__card">
        <h1 className="auth__title">Log in</h1>
        <p className="auth__lead">Welcome back. Log in to manage your cart and orders.</p>

        {notice && (
          <div className="banner banner--info" role="status" data-testid="login-notice">
            {notice}
          </div>
        )}

        <form className="form" onSubmit={handleSubmit} noValidate>
          <FormField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={handleChange}
            error={errors.email}
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={handleChange}
            error={errors.password}
          />

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="auth__switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </section>
  );
}
