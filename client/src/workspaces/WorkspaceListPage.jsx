import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAccessToken, createWorkspace, getMe, listWorkspaces, logout } from '../net/api';

export function WorkspaceListPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState({
    message: 'Server status: unknown',
    state: 'idle',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      try {
        setIsLoading(true);
        setLoadError('');
        const [mePayload, workspacesPayload] = await Promise.all([getMe(), listWorkspaces()]);

        if (isMounted) {
          setMe(mePayload.user);
          setWorkspaces(Array.isArray(workspacesPayload?.workspaces) ? workspacesPayload.workspaces : []);
        }
      } catch (error) {
        clearAccessToken();
        if (isMounted) {
          if (error?.status === 401) {
            navigate('/login', { replace: true });
            return;
          }
          setLoadError(error?.message || 'Failed to load workspaces.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPageData();

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

  async function handleCreateWorkspace(event) {
    event.preventDefault();
    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateError('Workspace name is required.');
      return;
    }

    try {
      setCreateError('');
      setIsCreating(true);
      const payload = await createWorkspace({ name: trimmed });
      const created = payload?.workspace;
      if (!created?.id) {
        throw new Error('Workspace creation failed.');
      }

      setWorkspaces((current) => [created, ...current]);
      setCreateName('');
      navigate(`/workspace/${created.id}`);
    } catch (error) {
      setCreateError(error?.message || 'Failed to create workspace.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero-card workspace-card">
        <p className="mono chip">Workspace Hub</p>
        <h1>{me?.displayName || me?.username ? `Welcome, ${me.displayName || me.username}` : 'Your Workspaces'}</h1>
        <p className="subtitle">Create a workspace or open one you are already a member of.</p>

        <form className="workspace-create-form" onSubmit={handleCreateWorkspace}>
          <input
            type="text"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="New workspace name"
            maxLength={200}
          />
          <button type="submit" disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
        {createError ? <p className="workspace-error">{createError}</p> : null}

        <div className="workspace-actions">
          <button type="button" onClick={handleHealthCheck}>
            Check API Health
          </button>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        {isLoading ? <p className="workspace-muted">Loading workspaces...</p> : null}
        {loadError ? <p className="workspace-error">{loadError}</p> : null}

        {!isLoading && !loadError ? (
          workspaces.length > 0 ? (
            <div className="workspace-grid">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  className="workspace-item"
                  onClick={() => navigate(`/workspace/${workspace.id}`)}
                >
                  <strong>{workspace.name}</strong>
                  <span>{workspace.role || 'member'}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="workspace-muted">No workspaces yet. Create one to start collaborating.</p>
          )
        ) : null}

        <p id="health-status" className="health-status" data-state={status.state}>
          {status.message}
        </p>
      </section>
    </main>
  );
}
