import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../net/api';

function validateForm(mode, values) {
  const username = values.username.trim();
  const password = values.password;
  const displayName = values.displayName.trim();

  if (username.length < 3 || username.length > 50) {
    return 'Username must be between 3 and 50 characters.';
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters.';
  }

  if (mode === 'register' && displayName.length > 100) {
    return 'Display name must be at most 100 characters.';
  }

  return null;
}

export function AuthUI({ mode = 'login' }) {
  const navigate = useNavigate();
  const isRegister = mode === 'register';
  const [values, setValues] = useState({
    username: '',
    password: '',
    displayName: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLabel = useMemo(() => {
    if (isSubmitting) {
      return isRegister ? 'Creating...' : 'Signing in...';
    }

    return isRegister ? 'Create account' : 'Sign in';
  }, [isRegister, isSubmitting]);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm(mode, values);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      if (isRegister) {
        await register({
          username: values.username.trim(),
          password: values.password,
          displayName: values.displayName.trim(),
        });
      } else {
        await login({
          username: values.username.trim(),
          password: values.password,
        });
      }

      navigate('/workspaces', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="auth-chip">LIGMA Auth</p>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-subtitle">
          {isRegister
            ? 'Register to start collaborating in workspaces.'
            : 'Sign in to continue to your workspaces.'}
        </p>

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <label className="field">
            <span>Username</span>
            <input
              name="username"
              type="text"
              minLength="3"
              maxLength="50"
              required
              value={values.username}
              onChange={handleChange}
            />
          </label>

          {isRegister ? (
            <label className="field">
              <span>Display name (optional)</span>
              <input
                name="displayName"
                type="text"
                maxLength="100"
                value={values.displayName}
                onChange={handleChange}
              />
            </label>
          ) : null}

          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              minLength="6"
              required
              value={values.password}
              onChange={handleChange}
            />
          </label>

          <p className="auth-error" aria-live="polite">
            {error}
          </p>

          <button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => navigate(isRegister ? '/login' : '/register')}
          >
            {isRegister ? 'Sign in' : 'Register'}
          </button>
        </p>
      </section>
    </main>
  );
}
