import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAccessToken, login, register } from "../net/api";

function validateForm(mode, values) {
  const username = values.username.trim();
  const password = values.password;
  const displayName = values.displayName.trim();

  if (username.length < 3 || username.length > 50) {
    return "Username must be between 3 and 50 characters.";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }

  if (mode === "register" && displayName.length > 100) {
    return "Display name must be at most 100 characters.";
  }

  return null;
}

export function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [formState, setFormState] = useState({
    username: "",
    password: "",
    displayName: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (getAccessToken()) {
      navigate("/workspaces", { replace: true });
    }
  }, [navigate]);

  const isRegister = mode === "register";

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm(mode, formState);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload =
        mode === "register"
          ? await register({
              username: formState.username.trim(),
              password: formState.password,
              displayName: formState.displayName.trim(),
            })
          : await login({
              username: formState.username.trim(),
              password: formState.password,
            });

      if (payload?.user) {
        navigate("/workspaces", { replace: true });
      }
    } catch (authError) {
      setError(authError.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="auth-chip">LIGMA Auth</p>
        <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-subtitle">
          {isRegister
            ? "Register to start collaborating in workspaces."
            : "Sign in to continue to your workspaces."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>Username</span>
            <input
              name="username"
              type="text"
              minLength={3}
              maxLength={50}
              required
              value={formState.username}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  username: event.target.value,
                }))
              }
            />
          </label>

          {isRegister ? (
            <label className="field">
              <span>Display name (optional)</span>
              <input
                name="displayName"
                type="text"
                maxLength={100}
                value={formState.displayName}
                onChange={(event) =>
                  setFormState((previous) => ({
                    ...previous,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>
          ) : null}

          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              minLength={6}
              required
              value={formState.password}
              onChange={(event) =>
                setFormState((previous) => ({
                  ...previous,
                  password: event.target.value,
                }))
              }
            />
          </label>

          <p className="auth-error" aria-live="polite">
            {error}
          </p>

          <button type="submit" disabled={submitting}>
            {submitting
              ? isRegister
                ? "Creating..."
                : "Signing in..."
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? "Already have an account? " : "Need an account? "}
          <Link
            className="link-button"
            to={isRegister ? "/login" : "/register"}
          >
            {isRegister ? "Sign in" : "Register"}
          </Link>
        </p>
      </section>
    </main>
  );
}
