import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
  getMe,
  logout,
} from "../net/api";

export function WorkspacesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [status, setStatus] = useState("Loading workspaces...");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [health, setHealth] = useState("unknown");

  useEffect(() => {
    async function load() {
      if (!getAccessToken()) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const me = await getMe();
        setUser(me.user);

        const response = await apiFetch("/api/workspaces");
        setWorkspaces(response.workspaces || []);
        setStatus(
          response.workspaces?.length
            ? ""
            : "No workspaces yet. Create one to get started.",
        );
      } catch (loadError) {
        clearAccessToken();
        navigate("/login", { replace: true });
        setError(loadError.message || "Unable to load workspaces.");
      }
    }

    load();
  }, [navigate]);

  async function handleCreateWorkspace(event) {
    event.preventDefault();

    if (!workspaceName.trim()) {
      setError("Workspace name is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await apiFetch("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: workspaceName.trim() }),
      });

      setWorkspaces((previous) => [response.workspace, ...previous]);
      setWorkspaceName("");
      setStatus("Workspace created.");
    } catch (createError) {
      setError(createError.message || "Failed to create workspace.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout().catch(() => {});
    clearAccessToken();
    navigate("/login", { replace: true });
  }

  async function checkHealth() {
    setHealth("checking");

    try {
      const response = await fetch("/api/health");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Health endpoint failed.");
      }

      setHealth(`online (${payload.service})`);
    } catch (_error) {
      setHealth("offline");
    }
  }

  return (
    <main className="workspace-shell">
      <section className="workspace-hero panel">
        <div>
          <p className="mono chip">Workspace Hub</p>
          <h1>Welcome{user?.username ? `, ${user.username}` : ""}</h1>
          <p className="subtitle">
            Create or open a workspace before we drop in the tldraw canvas.
          </p>
        </div>

        <div className="workspace-actions">
          <button type="button" onClick={checkHealth}>
            Check API Health
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="secondary-button"
          >
            Logout
          </button>
        </div>

        <p
          className="health-status"
          data-state={
            health === "online"
              ? "online"
              : health === "offline"
                ? "offline"
                : undefined
          }
        >
          Server status: {health}
        </p>
        {status ? <p className="muted-text">{status}</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}
      </section>

      <section className="workspace-grid">
        <form
          className="panel workspace-create"
          onSubmit={handleCreateWorkspace}
        >
          <p className="section-label">Create Workspace</p>
          <label className="field">
            <span>Name</span>
            <input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Sprint Planning"
              maxLength={120}
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create workspace"}
          </button>
        </form>

        <section className="panel workspace-list">
          <p className="section-label">Your Workspaces</p>
          {workspaces.length ? (
            <div className="workspace-card-grid">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  to={`/workspace/${workspace.id}`}
                  className="workspace-card"
                >
                  <strong>{workspace.name}</strong>
                  <span>{workspace.role || "member"}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted-text">No workspaces yet.</p>
          )}
        </section>
      </section>
    </main>
  );
}
