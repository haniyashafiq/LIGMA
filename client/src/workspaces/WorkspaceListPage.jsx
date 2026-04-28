import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAccessToken, getMe, logout } from '../net/api';

export function WorkspaceListPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState({
    message: 'Server status: unknown',
    state: 'idle',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const payload = await getMe();
        if (isMounted) {
          setMe(payload.user);
        }
      } catch (_error) {
        clearAccessToken();
        if (isMounted) {
          navigate('/login', { replace: true });
        }
      }
    }

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  async function handleHealthCheck() {
    setStatus({
      message: 'Server status: checking...',
      state: 'checking',
    });

    try {
      const response = await fetch('/api/health');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || 'Health endpoint failed');
      }

      setStatus({
        message: `Server status: online (${payload.service})`,
        state: 'online',
      });
    } catch (_error) {
      setStatus({
        message: 'Server status: unavailable',
        state: 'offline',
      });
    }
  }

  async function handleLogout() {
    await logout().catch(() => {});
    clearAccessToken();
    navigate('/login', { replace: true });
  }

  return (
    <main className="shell">
      <section className="hero-card">
        <p className="mono chip">Workspace Hub</p>
        <h1>{me?.displayName || me?.username ? `Welcome, ${me.displayName || me.username}` : 'Your Workspaces'}</h1>
        <p className="subtitle">Phase 5 will replace this with the workspace list UI.</p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigate('/workspace/demo-workspace')}>
            Open Canvas Prototype
          </button>
          <button type="button" onClick={handleHealthCheck}>
            Check API Health
          </button>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
        <p id="health-status" className="health-status" data-state={status.state}>
          {status.message}
        </p>
      </section>
    </main>
  );
}
