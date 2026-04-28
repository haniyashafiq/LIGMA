import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
  getMe,
} from "../net/api";
import { DashboardLayout } from "../layouts/DashboardLayout";

const TEMPLATES = [
  {
    id: "microservices",
    icon: "🔧",
    label: "Microservices Flow",
    desc: "Map out your service architecture.",
  },
  {
    id: "er-diagram",
    icon: "🗄",
    label: "ER Diagram",
    desc: "Structure your database relationships.",
  },
  {
    id: "user-journey",
    icon: "🗺",
    label: "User Journey",
    desc: "Visualise end-to-end user paths.",
  },
  {
    id: "security-audit",
    icon: "🔒",
    label: "Security Audit",
    desc: "Identify vulnerability spots.",
    badge: "Popular",
  },
];

// Deterministic colour for each canvas icon based on its index
const ICON_COLORS = [
  { bg: "rgba(46,196,182,0.18)",  color: "#2ec4b6" },
  { bg: "rgba(244,211,94,0.18)", color: "#e8b829" },
  { bg: "rgba(139,92,246,0.18)", color: "#8b5cf6" },
  { bg: "rgba(242,95,92,0.18)",  color: "#f25f5c" },
];

function canvasIcon(name = "", idx = 0) {
  return name.trim()[0]?.toUpperCase() || "C";
}

function relativeTime(dateString) {
  if (!dateString) return "";
  const diff = Date.now() - new Date(dateString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function WorkspacesPage() {
  const navigate = useNavigate();
  const [user, setUser]           = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]     = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!getAccessToken()) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const me  = await getMe();
        setUser(me.user);
        const res = await apiFetch("/api/workspaces");
        setWorkspaces(res.workspaces || []);
      } catch {
        clearAccessToken();
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      setWorkspaces((prev) => [res.workspace, ...prev]);
      setNewName("");
      setShowCreate(false);
    } catch (err) {
      setError(err.message || "Failed to create workspace.");
    } finally {
      setSubmitting(false);
    }
  }

  const recent = workspaces.slice(0, 3);

  return (
    <DashboardLayout user={user}>
      {/* ── Page header ─────────────────────── */}
      <div className="page-header">
        <div className="page-title">
          <h1>Canvases</h1>
          <p>Infinite workspaces for your team's architectural designs, flowcharts, and system mapping.</p>
        </div>

        <div className="page-actions">
          <button className="btn-ghost" aria-label="Filter canvases">
            ⚡ Filter
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowCreate(true)}
            id="new-canvas-btn"
          >
            + New Canvas
          </button>
        </div>
      </div>

      {/* ── Recent Canvases ─────────────────── */}
      <div className="section-header">
        <h2>Recent Canvases</h2>
        {workspaces.length > 3 && (
          <span className="view-all-link" style={{ cursor: "pointer" }}>
            View all
          </span>
        )}
      </div>

      <div className="recent-canvases-row">
        {/* Create blank card */}
        <div className="canvas-create-card" onClick={() => setShowCreate(true)}>
          <div className="canvas-create-plus">+</div>
          <div>
            <h3>Start a blank workspace</h3>
            <p>
              Begin a new architectural diagram or ideation session from scratch.
            </p>
          </div>
          <button
            className="canvas-create-link"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
            onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
          >
            Create Workspace →
          </button>
        </div>

        {/* Recent list */}
        <div className="canvas-list">
          {loading && (
            <div className="canvas-empty">
              <span className="canvas-empty-icon">⏳</span>
              <span>Loading canvases…</span>
            </div>
          )}

          {!loading && recent.length === 0 && (
            <div className="canvas-empty">
              <span className="canvas-empty-icon">⬡</span>
              <p>No canvases yet. Create one to get started.</p>
            </div>
          )}

          {recent.map((ws, idx) => {
            const col = ICON_COLORS[idx % ICON_COLORS.length];
            return (
              <Link
                key={ws.id}
                to={`/workspace/${ws.id}`}
                className="canvas-list-item"
                id={`canvas-item-${ws.id}`}
              >
                <div
                  className="canvas-list-icon"
                  style={{ background: col.bg, color: col.color }}
                >
                  {canvasIcon(ws.name, idx)}
                </div>

                <div className="canvas-list-info">
                  <p className="canvas-list-name">{ws.name}</p>
                  <div className="canvas-list-meta">
                    <span>Edited {relativeTime(ws.updated_at || ws.created_at)}</span>
                    <span>{ws.role || "member"}</span>
                  </div>
                </div>

                <div className="canvas-list-actions">
                  <div className="member-stack">
                    <div className="member-pip" style={{ background: col.color }}>
                      {canvasIcon(ws.name, idx)}
                    </div>
                  </div>
                  <button
                    className="canvas-kebab"
                    onClick={(e) => e.preventDefault()}
                    aria-label="More options"
                  >
                    ⋯
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Workspace Templates ─────────────── */}
      <div className="section-header">
        <h2>Workspace Templates</h2>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
          Accelerate your workflow
        </span>
      </div>

      <div className="templates-grid">
        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            className="template-card"
            role="button"
            tabIndex={0}
            id={`template-${t.id}`}
            onClick={() => setShowCreate(true)}
            onKeyDown={(e) => e.key === "Enter" && setShowCreate(true)}
          >
            <div className="template-card-icon">{t.icon}</div>
            <h3>{t.label}</h3>
            <p>{t.desc}</p>
            {t.badge && <span className="template-badge">{t.badge}</span>}
          </div>
        ))}
      </div>

      {/* ── Create Modal ────────────────────── */}
      {showCreate && (
        <div
          className="create-modal-backdrop"
          onClick={() => setShowCreate(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Create new canvas"
        >
          <div
            className="create-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>New Canvas</h2>

            <form onSubmit={handleCreate} className="auth-form">
              <label className="field">
                <span>Canvas name</span>
                <input
                  autoFocus
                  id="new-canvas-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sprint Planning"
                  maxLength={120}
                />
              </label>

              {error && <p className="auth-error">{error}</p>}

              <div className="create-modal-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !newName.trim()}
                  id="create-canvas-submit"
                >
                  {submitting ? "Creating…" : "Create Canvas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
