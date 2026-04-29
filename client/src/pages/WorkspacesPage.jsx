import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiFilter,
  FiMoreHorizontal,
  FiGitBranch,
  FiDatabase,
  FiMap,
  FiShield,
  FiLoader,
  FiHexagon,
  FiArrowRight,
} from "react-icons/fi";
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
    Icon: FiGitBranch,
    label: "Microservices Flow",
    desc: "Map out your service architecture.",
  },
  {
    id: "er-diagram",
    Icon: FiDatabase,
    label: "ER Diagram",
    desc: "Structure your database relationships.",
  },
  {
    id: "user-journey",
    Icon: FiMap,
    label: "User Journey",
    desc: "Visualise end-to-end user paths.",
  },
  {
    id: "security-audit",
    Icon: FiShield,
    label: "Security Audit",
    desc: "Identify vulnerability spots.",
    badge: "Popular",
  },
];

const ICON_COLORS = [
  { bg: "rgba(14,165,233,0.15)", color: "#0EA5E9" },
  { bg: "rgba(245,158,11,0.15)", color: "#F59E0B" },
  { bg: "rgba(139,92,246,0.15)", color: "#8B5CF6" },
  { bg: "rgba(239,68,68,0.15)",  color: "#EF4444" },
];

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
  const [user, setUser]             = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [newName, setNewName]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll]       = useState(false);

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
        body: JSON.stringify({ 
          name: newName.trim(),
          templateId: activeTemplate?.id || null
        }),
      });
      setWorkspaces((prev) => [res.workspace, ...prev]);
      setNewName("");
      setActiveTemplate(null);
      setShowCreate(false);
    } catch (err) {
      setError(err.message || "Failed to create workspace.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteWorkspace(workspaceId) {
    if (!window.confirm("Are you sure you want to delete this workspace? This cannot be undone.")) return;
    
    try {
      await apiFetch(`/api/workspaces/${workspaceId}`, {
        method: "DELETE",
      });
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
    } catch (err) {
      alert(err.message || "Failed to delete workspace.");
    }
  }

  const myWorkspaces = workspaces.filter(ws => String(ws.createdBy) === String(user?.id));
  const invitedWorkspaces = workspaces.filter(ws => String(ws.createdBy) !== String(user?.id));

  const displayedWorkspaces = showAll ? myWorkspaces : myWorkspaces.slice(0, 6);

  return (
    <DashboardLayout user={user}>
      {/* ── Page header ─────────────────────── */}
      <div className="page-header">
        <div className="page-title">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1>Canvases</h1>
            <span className="noob-tip">
              <FiPlus size={10} />
              Start here
            </span>
          </div>
          <p>Infinite workspaces for your team's architectural designs, flowcharts, and system mapping.</p>
        </div>

        <div className="page-actions">
          <button className="btn-ghost" aria-label="Filter canvases">
            <FiFilter size={14} />
            Filter
          </button>
          <button
            className="btn-primary creative-glow"
            onClick={() => setShowCreate(true)}
            id="new-canvas-btn"
          >
            <FiPlus size={15} />
            New Canvas
          </button>
        </div>
      </div>

       {/* ── Your Canvases ─────────────────────── */}
      <div className="section-header">
        <h2>{showAll ? "All Your Canvases" : "Your Canvases"}</h2>
        {workspaces.length > 6 && (
          <span 
            className="view-all-link" 
            style={{ cursor: "pointer" }}
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show less" : "View all"}
          </span>
        )}
      </div>

      <div className="recent-canvases-row">
        {/* Create blank card */}
        <div className="canvas-create-card creative-glow" onClick={() => setShowCreate(true)}>
          <div className="canvas-create-plus" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-role-lead))" }}>
            <FiPlus size={22} color="white" />
          </div>
          <div>
            <h3>Start a blank workspace</h3>
            <p>Begin a new architectural diagram or ideation session from scratch.</p>
          </div>
          <button
            className="canvas-create-link"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", color: "var(--color-primary)" }}
            onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
          >
            Create Workspace
            <FiArrowRight size={14} />
          </button>
        </div>

        {/* Recent list */}
        <div className="canvas-list">
          {loading && (
            <div className="canvas-empty">
              <FiLoader size={32} className="canvas-empty-icon" style={{ opacity: 0.4 }} />
              <span>Loading canvases…</span>
            </div>
          )}

          {!loading && displayedWorkspaces.length === 0 && (
            <div className="canvas-empty">
              <FiHexagon size={36} className="canvas-empty-icon" style={{ opacity: 0.3 }} />
              <p>No canvases yet. Create one to get started.</p>
            </div>
          )}

          {displayedWorkspaces.map((ws, idx) => {
            const col = ICON_COLORS[idx % ICON_COLORS.length];
            const letter = ws.name.trim()[0]?.toUpperCase() || "C";
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
                  {letter}
                </div>

                <div className="canvas-list-info">
                  <p className="canvas-list-name">{ws.name}</p>
                  <div className="canvas-list-meta">
                    <span>Edited {relativeTime(ws.updated_at || ws.created_at)}</span>
                    <span>{ws.role || "member"}</span>
                  </div>
                </div>

                 <div className="canvas-list-actions">
                  {ws.role === "lead" && (
                    <button
                      className="canvas-kebab"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteWorkspace(ws.id);
                      }}
                      title="Delete Workspace"
                    >
                      <FiMoreHorizontal size={15} />
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Shared with You ─────────────────── */}
      {invitedWorkspaces.length > 0 && (
        <>
          <div className="section-header" style={{ marginTop: '48px' }}>
            <h2>Shared with You</h2>
          </div>
          <div className="canvas-list" style={{ marginTop: '16px' }}>
            {invitedWorkspaces.map((ws, idx) => {
              const col = ICON_COLORS[idx % ICON_COLORS.length];
              const letter = ws.name.trim()[0]?.toUpperCase() || "C";
              return (
                <Link
                  key={ws.id}
                  to={`/workspace/${ws.id}`}
                  className="canvas-list-item"
                  id={`canvas-item-invited-${ws.id}`}
                >
                  <div
                    className="canvas-list-icon"
                    style={{ background: col.bg, color: col.color }}
                  >
                    {letter}
                  </div>

                  <div className="canvas-list-info">
                    <p className="canvas-list-name">{ws.name}</p>
                    <div className="canvas-list-meta">
                      <span>Edited {relativeTime(ws.updated_at || ws.created_at)}</span>
                      <span>{ws.role || "member"}</span>
                    </div>
                  </div>

                   <div className="canvas-list-actions">
                    {ws.role === "lead" && (
                      <button
                        className="canvas-kebab"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteWorkspace(ws.id);
                        }}
                        title="Delete Workspace"
                      >
                        <FiMoreHorizontal size={15} />
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ── Workspace Templates ─────────────── */}
      <div className="section-header">
        <h2>Workspace Templates</h2>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
          Accelerate your workflow
        </span>
      </div>

      <div className="templates-grid">
        {TEMPLATES.map(({ id, Icon, label, desc, badge }) => (
          <div
            key={id}
            className="template-card"
            role="button"
            tabIndex={0}
            id={`template-${id}`}
             onClick={() => {
              setActiveTemplate({ id, label });
              setNewName(`${label} Workspace`);
              setShowCreate(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setActiveTemplate({ id, label });
                setNewName(`${label} Workspace`);
                setShowCreate(true);
              }
            }}
          >
            <div className="template-card-icon">
              <Icon size={22} style={{ color: "var(--color-primary)" }} />
            </div>
            <h3>{label}</h3>
            <p>{desc}</p>
            {badge && <span className="template-badge">{badge}</span>}
          </div>
        ))}
      </div>

      {/* ── Create Modal ────────────────────── */}
      {showCreate && (
        <div
          className="create-modal-backdrop"
          onClick={() => { setShowCreate(false); setActiveTemplate(null); }}
          role="dialog"
          aria-modal="true"
          aria-label="Create new canvas"
        >
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{activeTemplate ? `Use ${activeTemplate.label} Template` : 'New Canvas'}</h2>

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
