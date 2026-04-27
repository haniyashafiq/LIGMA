import './styles/index.css';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('Missing #app root element');
}

app.innerHTML = `
  <main class="shell">
    <section class="hero-card">
      <p class="mono chip">Realtime Collaboration Workspace</p>
      <h1>LIGMA</h1>
      <p class="subtitle">
        Let's Integrate Groups, Manage Anything.
      </p>
      <button type="button" id="health-btn">Check API Health</button>
      <p id="health-status" class="health-status">Server status: unknown</p>
    </section>
  </main>
`;

const healthBtn = document.querySelector('#health-btn');
const healthStatus = document.querySelector('#health-status');

async function checkHealth() {
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
}

healthBtn?.addEventListener('click', checkHealth);
