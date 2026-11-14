// F1 - Register page
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { validateRegister } from '../validation';
import { useToast } from '../components/Toast';
import FormField from '../components/FormField';

const EMPTY = { name: '', email: '', password: '', confirmPassword: '' };

export default function Register() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    // Clear a field's error as soon as the user edits it.
    if (errors[name]) setErrors(({ [name]: _removed, ...rest }) => rest);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // 1. Check the form in the browser first (same rules as the server).
    const fieldErrors = validateRegister(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      document.getElementById(Object.keys(fieldErrors)[0])?.focus();
      return;
    }

    // 2. Send to the server.
    setSubmitting(true);
    try {
      const data = await api('/auth/register', { method: 'POST', body: values });
      toast.success(data.message); // "Account created successfully. Please log in."
      navigate('/login', { state: { email: data.user.email } });
    } catch (err) {
      // e.g. 409 "This email is already registered." (also shown under the email field)
      setErrors(err.fields || {});
      toast.error(err.message);
      setSubmitting(false);
    }
  }

  return (
    <section className="auth">
      <div className="card auth__card">
        <h1 className="auth__title">Create your account</h1>
        <p className="auth__lead">Register to add books to your cart and place orders.</p>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <FormField
            id="name"
            label="Full name"
            autoComplete="name"
            value={values.name}
            onChange={handleChange}
            error={errors.name}
          />
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
            autoComplete="new-password"
            value={values.password}
            onChange={handleChange}
            error={errors.password}
            hint="At least 8 characters, with a letter and a number."
          />
          <FormField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
          />

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth__switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </section>
  );
}
