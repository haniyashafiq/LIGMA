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

function renderTemplate(mode) {
  const isRegister = mode === 'register';

  return `
    <main class="auth-shell">
      <section class="auth-card">
        <p class="auth-chip">LIGMA Auth</p>
        <h1>${isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p class="auth-subtitle">
          ${isRegister ? 'Register to start collaborating in workspaces.' : 'Sign in to continue to your workspaces.'}
        </p>
        <form id="auth-form" class="auth-form" novalidate>
          <label class="field">
            <span>Username</span>
            <input name="username" type="text" minlength="3" maxlength="50" required />
          </label>
          ${
            isRegister
              ? `
          <label class="field">
            <span>Display name (optional)</span>
            <input name="displayName" type="text" maxlength="100" />
          </label>
          `
              : ''
          }
          <label class="field">
            <span>Password</span>
            <input name="password" type="password" minlength="6" required />
          </label>
          <p id="auth-error" class="auth-error" aria-live="polite"></p>
          <button id="auth-submit" type="submit">${isRegister ? 'Create account' : 'Sign in'}</button>
        </form>
        <p class="auth-switch">
          ${
            isRegister
              ? 'Already have an account? <button type="button" id="switch-mode" class="link-button">Sign in</button>'
              : 'Need an account? <button type="button" id="switch-mode" class="link-button">Register</button>'
          }
        </p>
      </section>
    </main>
  `;
}

export function mountAuthUI(rootElement, { mode = 'login', onAuthSuccess, onSwitchMode } = {}) {
  rootElement.innerHTML = renderTemplate(mode);

  const form = rootElement.querySelector('#auth-form');
  const errorEl = rootElement.querySelector('#auth-error');
  const submitBtn = rootElement.querySelector('#auth-submit');
  const switchModeBtn = rootElement.querySelector('#switch-mode');

  if (!form || !errorEl || !submitBtn) {
    throw new Error('Auth UI failed to render required elements.');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const values = {
      username: String(formData.get('username') || ''),
      password: String(formData.get('password') || ''),
      displayName: String(formData.get('displayName') || ''),
    };

    const validationError = validateForm(mode, values);
    if (validationError) {
      errorEl.textContent = validationError;
      return;
    }

    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'register' ? 'Creating...' : 'Signing in...';

    try {
      const payload =
        mode === 'register'
          ? await register({
              username: values.username.trim(),
              password: values.password,
              displayName: values.displayName.trim(),
            })
          : await login({
              username: values.username.trim(),
              password: values.password,
            });

      if (typeof onAuthSuccess === 'function') {
        onAuthSuccess(payload.user);
      }
    } catch (error) {
      errorEl.textContent = error.message || 'Authentication failed.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'register' ? 'Create account' : 'Sign in';
    }
  });

  switchModeBtn?.addEventListener('click', () => {
    if (typeof onSwitchMode === 'function') {
      onSwitchMode(mode === 'register' ? 'login' : 'register');
    }
  });
}
