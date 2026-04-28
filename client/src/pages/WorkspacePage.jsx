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
  FiArrowLeft,
  FiRotateCcw,
  FiRotateCw,
  FiClock,
  FiActivity,
  FiLink,
  FiZap,
  FiShare2,
  FiMaximize,
  FiLogOut,
} from "react-icons/fi";
import CanvasView from "../components/CanvasView";
import { AppContext } from "../utils/AppContext";
import { apiFetch, getAccessToken, logout, clearAccessToken } from "../net/api";
import "../styles/workspace.css";

const TOOLS = [
  { id: "select", Icon: FiMousePointer, label: "Select" },
  { id: "hand", Icon: FiMove, label: "Hand" },
  { id: "geo", Icon: FiSquare, label: "Shapes" },
  { id: "text", Icon: FiType, label: "Text" },
  { id: "draw", Icon: FiEdit2, label: "Pen" },
  { id: "arrow", Icon: FiArrowUpRight, label: "Arrow" },
  { id: "note", Icon: FiFileText, label: "Notes" },
  { id: "eraser", Icon: FiTrash2, label: "Eraser" },
];

const TOOL_EXTRAS = [
  { id: "layers", Icon: FiLayers, label: "Layers" },
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
  const [layersOpen, setLayersOpen] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [layersVersion, setLayersVersion] = useState(0);

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("todo");
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

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
      .catch(() => { });
  }, [workspaceId, setCurrentWorkspace, navigate]);

  // Sync editor tool with activeTool state
  useEffect(() => {
    if (editor && activeTool) {
      try {
        editor.setCurrentTool(activeTool);
      } catch (err) {
        console.warn("[Workspace] Failed to set tool:", activeTool, err);
      }
    }
  }, [editor, activeTool]);

  const loadTasks = useCallback(() => {
    apiFetch(`/api/workspaces/${workspaceId}/tasks`)
      .then((res) => setTasks(res.tasks || []))
      .catch(() => { });
  }, [workspaceId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleToolSelect = useCallback((toolId) => {
    setActiveTool(toolId);
  }, []);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsSubmittingTask(true);
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          status: newTaskStatus,
        }),
      });
      setNewTaskTitle("");
      setNewTaskStatus("todo");
      setShowAddTask(false);
      loadTasks();
    } catch (err) {
      console.error("Failed to add task:", err);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const onCanvasMount = useCallback((editorInstance) => {
    console.log("[Workspace] Canvas mounted", editorInstance);
    setEditor(editorInstance);

    // Force re-render when shapes change to keep layers list in sync
    const handleChange = () => {
      setLayersVersion((v) => v + 1);
    };

    editorInstance.on("change", handleChange);
  }, []);

  const connectionDot =
    connectionStatus === "online"
      ? "online"
      : connectionStatus === "error"
        ? "offline"
        : "connecting";

  const handleLogout = async () => {
    await logout().catch(() => { });
    clearAccessToken();
    navigate("/login", { replace: true });
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  return (
    <div
      className="workspace-shell"
      style={{ display: "flex", flexDirection: "column", height: "100dvh" }}
    >
      {/* ── Top Navigation Bar ──────────────────────── */}
      <header className="workspace-topbar">
        <div className="workspace-topbar-left">
          <button 
            className="ws-topbar-back-btn" 
            onClick={() => navigate("/workspaces")}
            title="Go back to projects"
          >
            <FiArrowLeft size={16} />
          </button>

          <Link to="/workspaces" className="workspace-topbar-logo">
            <span className="workspace-topbar-logo-mark">LIGMA</span>
          </Link>

          <div className="ws-name-container">
            <span className="ws-name-label">{workspaceName}</span>
          </div>

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

          <button
            className="ws-topbar-icon-btn"
            aria-label="Logout"
            title="Logout"
            onClick={handleLogout}
            style={{ marginLeft: 4 }}
          >
            <FiLogOut size={15} color="var(--color-danger)" />
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
              className={`ws-tool-btn${id === "layers" && layersOpen ? " active" : ""}`}
              title={label}
              aria-label={label}
              onClick={() => {
                if (id === "layers") setLayersOpen(!layersOpen);
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Canvas Area */}
        <div className="ws-canvas-area">
          <CanvasView 
            workspaceId={workspaceId} 
            onMount={onCanvasMount} 
            gridMode={gridEnabled}
          />

          {layersOpen && (
            <div className="ws-layers-panel">
              <div className="ws-layers-header">
                <span>Layers</span>
                <button onClick={() => setLayersOpen(false)}><FiPlus style={{ transform: "rotate(45deg)" }} /></button>
              </div>
              <div className="ws-layers-list">
                {!editor && <div className="ws-layers-empty">Loading editor...</div>}
                {editor && editor.getCurrentPageShapes().length === 0 && (
                  <div className="ws-layers-empty">No layers yet</div>
                )}
                {editor && [...editor.getCurrentPageShapes()]
                  .sort((a, b) => (a.index < b.index ? 1 : -1))
                  .map(shape => (
                  <div 
                    key={shape.id} 
                    className="ws-layer-item"
                    onClick={() => {
                      editor.select(shape.id);
                      editor.zoomToSelection();
                    }}
                  >
                    <FiSquare size={12} />
                    <span>{shape.type} - {shape.id.split(':')[1].substring(0, 4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
            <button 
              className={`ws-bottom-btn${gridEnabled ? " active" : ""}`} 
              title="Toggle Grid"
              onClick={() => setGridEnabled(!gridEnabled)}
            >
              <FiSquare size={14} />
            </button>
            <button 
              className="ws-bottom-btn" 
              title="Toggle Fullscreen"
              onClick={toggleFullScreen}
            >
              <FiMaximize size={14} />
            </button>
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
                      <div className="ws-task-header-left">
                        <span className={`ws-task-badge ${!task.source_node_id ? "manual" : "auto"}`}>
                          {!task.source_node_id ? "✦ Manual" : "✦ Canvas"}
                        </span>
                      </div>
                      <span className="ws-task-added-by">
                        {task.authorName || "Direct Entry"}
                      </span>
                    </div>
                    <p className="ws-task-title">{task.title}</p>
                    <div className="ws-task-footer">
                      <span className={`ws-task-status ${task.status}`}>
                        {task.status === 'in_progress' ? 'Doing' : task.status}
                      </span>
                      <div className="ws-task-footer-actions">
                        {task.source_node_id && (
                          <button className="ws-task-link-btn" title="View on canvas">
                            <FiLink size={10} />
                          </button>
                        )}
                        <div className="ws-task-user-pip">
                          {(task.authorName || "U")[0]}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Task Overlay */}
            {showAddTask && (
              <div className="ws-add-task-overlay">
                <form className="ws-add-task-form" onSubmit={handleAddTask}>
                  <div className="ws-modal-header">
                    <h3>New Task</h3>
                    <button type="button" className="ws-close-btn" onClick={() => setShowAddTask(false)}>
                      <FiPlus size={18} style={{ transform: 'rotate(45deg)' }} />
                    </button>
                  </div>
                  
                  <div className="ws-form-content">
                    <div className="ws-form-field">
                      <textarea
                        autoFocus
                        placeholder="Task description..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="ws-form-row">
                      <div className="ws-field-group">
                        <label>Status</label>
                        <div className="ws-status-toggle">
                          {['todo', 'doing', 'done'].map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={newTaskStatus === s ? 'active' : ''}
                              onClick={() => setNewTaskStatus(s)}
                            >
                              {s === 'doing' ? 'Doing' : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="ws-form-footer">
                    <button
                      type="submit"
                      className="ws-submit-btn creative-glow"
                      disabled={isSubmittingTask || !newTaskTitle.trim()}
                    >
                      {isSubmittingTask ? "Creating..." : "Create Task"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Footer Actions */}
            <div className="ws-exec-footer">
              <button
                className="ws-add-task-btn"
                onClick={() => setShowAddTask(true)}
              >
                <FiPlus size={14} />
                Add Task
              </button>
              <button className="ws-sprint-btn creative-glow">
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
