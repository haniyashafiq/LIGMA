import React, { useContext, useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  FiMousePointer,
  FiMove,
  FiSquare,
  FiType,
  FiEdit2,
  FiFileText,
  FiArrowUpRight,
  FiTrash2,
  FiLayers,
  FiSettings,
  FiBell,
  FiHelpCircle,
  FiPlus,
  FiMoreHorizontal,
  FiSearch,
  FiZoomIn,
  FiRotateCcw,
  FiRotateCw,
  FiClock,
  FiActivity,
  FiLink,
  FiZap,
  FiShare2,
} from "react-icons/fi";
import CanvasView from "../components/CanvasView";
import { AppContext } from "../utils/AppContext";
import { apiFetch, getAccessToken } from "../net/api";
import "../styles/workspace.css";

const TOOLS = [
  { id: "select",  Icon: FiMousePointer, label: "Select" },
  { id: "hand",    Icon: FiMove,         label: "Hand" },
  { id: "geo",     Icon: FiSquare,       label: "Shapes" },
  { id: "text",    Icon: FiType,         label: "Text" },
  { id: "draw",    Icon: FiEdit2,        label: "Pen" },
  { id: "arrow",   Icon: FiArrowUpRight, label: "Arrow" },
  { id: "note",    Icon: FiFileText,     label: "Notes" },
  { id: "eraser",  Icon: FiTrash2,       label: "Eraser" },
];

const TOOL_EXTRAS = [
  { id: "layers",   Icon: FiLayers,   label: "Layers" },
  { id: "settings", Icon: FiSettings, label: "Config" },
];

const MOCK_ACTIVITY = [
  {
    id: 1,
    user: "You",
    color: "#0D99FF",
    action: "joined the workspace",
    time: "just now",
  },
];

export function WorkspacePage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const {
    setCurrentWorkspace,
    connectionStatus,
    setTaskPanelOpen,
  } = useContext(AppContext);

  const [editor, setEditor] = useState(null);
  const [activeTool, setActiveTool] = useState("select");
  const [activeTab, setActiveTab] = useState("workspace");
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [tasks, setTasks] = useState([]);
  const [execOpen, setExecOpen] = useState(true);

  // Load workspace metadata
  useEffect(() => {
    if (!getAccessToken()) {
      navigate("/login", { replace: true });
      return;
    }

    if (typeof setCurrentWorkspace === "function") {
      setCurrentWorkspace(workspaceId || null);
    }

    apiFetch(`/api/workspaces`)
      .then((res) => {
        const ws = (res.workspaces || []).find(
          (w) => String(w.id) === String(workspaceId)
        );
        if (ws) setWorkspaceName(ws.name);
      })
      .catch(() => {});
  }, [workspaceId, setCurrentWorkspace, navigate]);

  // Sync editor tool with activeTool state
  useEffect(() => {
    if (editor && activeTool) {
      try {
        editor.setSelectedTool(activeTool);
      } catch (err) {
        console.warn("[Workspace] Failed to set tool:", activeTool, err);
      }
    }
  }, [editor, activeTool]);

  // Load tasks for this workspace
  useEffect(() => {
    apiFetch(`/api/workspaces/${workspaceId}/tasks`)
      .then((res) => setTasks(res.tasks || []))
      .catch(() => {});
  }, [workspaceId]);

  const handleToolSelect = useCallback((toolId) => {
    setActiveTool(toolId);
  }, []);

  const onCanvasMount = useCallback((editorInstance) => {
    console.log("[Workspace] Canvas mounted", editorInstance);
    setEditor(editorInstance);
  }, []);

  const connectionDot =
    connectionStatus === "online"
      ? "online"
      : connectionStatus === "error"
      ? "offline"
      : "connecting";

  return (
    <div
      className="workspace-shell"
      style={{ display: "flex", flexDirection: "column", height: "100dvh" }}
    >
      {/* ── Top Navigation Bar ──────────────────────── */}
      <header className="workspace-topbar">
        <div className="workspace-topbar-left">
          <Link to="/workspaces" className="workspace-topbar-logo">
            <span className="workspace-topbar-logo-mark">LIGMA</span>
          </Link>

          <div className="workspace-topbar-tabs">
            {["Workspace", "Assets", "Timeline", "Integrations"].map((tab) => (
              <button
                key={tab}
                className={
                  "workspace-tab" +
                  (activeTab === tab.toLowerCase() ? " active" : "")
                }
                onClick={() => setActiveTab(tab.toLowerCase())}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="workspace-topbar-right">
          <button
            className="ws-topbar-icon-btn"
            aria-label="Notifications"
            title="Notifications"
          >
            <FiBell size={15} />
          </button>
          <button
            className="ws-topbar-icon-btn"
            aria-label="Help"
            title="Help"
          >
            <FiHelpCircle size={15} />
          </button>

          <button className="ws-share-btn">
            <FiShare2 size={12} style={{ marginRight: 4 }} />
            Share
          </button>

          <button
            className="ws-mode-badge"
            title="Connection status"
          >
            <span className={`ws-connection-dot ${connectionDot}`} />
            {connectionStatus === "online" ? "Connected" : "Connecting…"}
          </button>

          <button
            className="ws-topbar-settings"
            aria-label="Settings"
            onClick={() => setExecOpen((v) => !v)}
          >
            <FiSettings size={15} />
          </button>
        </div>
      </header>

      {/* ── Workspace Body ──────────────────────────── */}
      <div className="workspace-body">
        {/* Left Tool Panel */}
        <div className="ws-tool-panel">
          <span className="ws-tool-panel-label">Tools</span>

          {TOOLS.map(({ id, Icon, label }) => (
            <button
              key={id}
              className={`ws-tool-btn${activeTool === id ? " active" : ""}`}
              onClick={() => handleToolSelect(id)}
              title={label}
              aria-label={label}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}

          <div className="ws-tool-divider" />

          {TOOL_EXTRAS.map(({ id, Icon, label }) => (
            <button
              key={id}
              className="ws-tool-btn"
              title={label}
              aria-label={label}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Canvas Area */}
        <div className="ws-canvas-area">
          <CanvasView workspaceId={workspaceId} onMount={onCanvasMount} />

          {/* Bottom Toolbar */}
          <div className="ws-bottom-bar">
            <div className="ws-zoom-display">
              <FiSearch size={12} />
              100%
            </div>
            <div className="ws-bottom-divider" />
            <button className="ws-bottom-btn" title="Undo">
              <FiRotateCcw size={14} />
            </button>
            <button className="ws-bottom-btn" title="Redo">
              <FiRotateCw size={14} />
            </button>
            <div className="ws-bottom-divider" />
            <button className="ws-bottom-btn" title="History">
              <FiClock size={14} />
            </button>
          </div>
        </div>

        {/* Execution Panel (Right Sidebar) */}
        {execOpen && (
          <aside className="ws-exec-panel">
            <div className="ws-exec-header">
              <h2>Execution Panel</h2>
              <button
                className="ws-exec-more-btn"
                aria-label="Panel options"
              >
                <FiMoreHorizontal size={14} />
              </button>
            </div>

            <div className="ws-exec-scroll">
              {/* Activity Log Section */}
              <div className="ws-section-toggle">
                <h3>
                  <FiActivity size={12} />
                  Activity Log
                </h3>
                <button className="ws-section-add-btn" aria-label="Add entry">
                  <FiPlus size={12} />
                </button>
              </div>

              <ul className="ws-activity-list">
                {MOCK_ACTIVITY.map((item) => (
                  <li key={item.id} className="ws-activity-item">
                    <div
                      className="ws-activity-avatar"
                      style={{ background: item.color }}
                    >
                      {item.user[0]}
                    </div>
                    <div className="ws-activity-body">
                      <p>
                        <strong>{item.user}</strong> {item.action}
                      </p>
                      <div className="ws-activity-time">{item.time}</div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Task Board Section */}
              <div className="ws-section-toggle">
                <h3>
                  <FiFileText size={12} />
                  Task Board
                </h3>
                <button className="ws-section-add-btn" aria-label="Sort tasks">
                  <FiMoreHorizontal size={12} />
                </button>
              </div>

              <div className="ws-task-section">
                {tasks.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "var(--space-6) 0",
                      color: "var(--color-text-subtle)",
                      fontSize: "var(--text-xs)",
                    }}
                  >
                    No tasks yet. Create sticky notes with [TASK] to generate
                    tasks.
                  </div>
                )}

                {tasks.map((task) => (
                  <div key={task.id} className="ws-task-card">
                    <div className="ws-task-card-header">
                      <span
                        className={`ws-task-badge ${
                          task.source === "ai" ? "ai" : "action"
                        }`}
                      >
                        {task.source === "ai" ? "✦ AI" : "✦ Action Item"}
                      </span>
                      <span className="ws-task-added-by">
                        Added by {task.authorName || "User"}
                      </span>
                    </div>
                    <p className="ws-task-title">{task.title}</p>
                    <div className="ws-task-footer">
                      <span
                        className={`ws-task-status ${
                          task.status === "DOING"
                            ? "in-progress"
                            : task.status === "DONE"
                            ? "done"
                            : ""
                        }`}
                      >
                        {task.status || "Todo"}
                      </span>
                      <div className="ws-task-footer-actions">
                        <button
                          className="ws-task-link-btn"
                          title="View on canvas"
                        >
                          <FiLink size={12} />
                        </button>
                        <div
                          className="ws-task-user-pip"
                          style={{ background: "#0D99FF" }}
                        >
                          {(task.authorName || "U")[0]}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="ws-exec-footer">
              <button className="ws-add-task-btn">
                <FiPlus size={13} />
                Add Task
              </button>
              <button className="ws-sprint-btn">
                <FiZap size={13} />
                Execute Sprint
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
