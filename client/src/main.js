import './styles/index.css';
import './styles/auth.css';
import { mountAuthUI } from './auth/AuthUI';
import { clearAccessToken, getAccessToken, getMe, logout } from './net/api';
import { renderAIAssistantUI } from './ai/AIAssistantUI';
import './styles/ai.css';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('Missing #app root element');
}

function navigate(hash) {
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    renderRoute();
  }
}

function renderWorkspaceShell() {
  app.innerHTML = `
    <main class="shell">
      <section class="hero-card">
        <p class="mono chip">Workspace Hub</p>
        <h1>Your Workspaces</h1>
        <p class="subtitle">Phase 5 will replace this with the workspace list UI.</p>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
          <button id="health-btn" type="button">Check API Health</button>
          <button id="logout-btn" type="button">Logout</button>
        </div>
        <p id="health-status" class="health-status">Server status: unknown</p>
      </section>
    </main>
  `;

  const healthBtn = app.querySelector('#health-btn');
  const logoutBtn = app.querySelector('#logout-btn');
  const healthStatus = app.querySelector('#health-status');

  healthBtn?.addEventListener('click', async () => {
    if (!healthStatus) {
      return;
    }

    healthStatus.textContent = 'Server status: checking...';
    try {
      const response = await fetch('/api/health');
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Health endpoint failed');
      }
      healthStatus.textContent = `Server status: online (${payload.service})`;
      healthStatus.dataset.state = 'online';
    } catch (_error) {
      healthStatus.textContent = 'Server status: unavailable';
      healthStatus.dataset.state = 'offline';
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    await logout().catch(() => {});
    clearAccessToken();
    navigate('#/login');
  });
}

async function renderRoute() {
  const hash = window.location.hash || '#/login';

  if (hash === '#/register') {
    mountAuthUI(app, {
      mode: 'register',
      onAuthSuccess: () => navigate('#/ai-assistant'),
      onSwitchMode: () => navigate('#/login'),
    });
    return;
  }

  if (hash === '#/login') {
    mountAuthUI(app, {
      mode: 'login',
      onAuthSuccess: () => navigate('#/ai-assistant'),
      onSwitchMode: () => navigate('#/register'),
    });
    return;
  }

  if (hash === '#/workspaces') {
    if (!getAccessToken()) {
      navigate('#/login');
      return;
    }

    try {
      await getMe();
      renderWorkspaceShell();
    } catch (_error) {
      clearAccessToken();
      navigate('#/login');
    }
    return;
  }

  if (hash === '#/ai-assistant') {
    if (!getAccessToken()) {
      navigate('#/login');
      return;
    }

    try {
      await getMe();
      renderAIAssistantUI(app);
    } catch (_error) {
      clearAccessToken();
      navigate('#/login');
    }
    return;
  }

  if (hash === '#/logout') {
    await logout().catch(() => {});
    clearAccessToken();
    navigate('#/login');
    return;
  }

  navigate('#/login');
}

window.addEventListener('hashchange', renderRoute);
renderRoute();
