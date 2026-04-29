import React, { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
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
  FiFilter,
  FiZoomOut,
  FiMoon,
  FiSun,
  FiShare2,
  FiMaximize,
  FiCrosshair,
  FiLogOut,
  FiUsers,
} from "react-icons/fi";
import CanvasView from "../components/CanvasView";
import CanvasReplay, { useCanvasReplay, ReplayControls, ReplayOverlay } from "../components/CanvasReplay";
import { AppContext } from "../utils/AppContext";
import {
  apiFetch,
  getAccessToken,
  getMe,
  logout,
  clearAccessToken,
} from "../net/api";
import MembersSidebar from "../workspace/MembersSidebar";
import ShareWorkspaceModal from "../workspace/ShareWorkspaceModal";
import RoleBadge from "../workspace/RoleBadge";
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
  const { workspaceId, tab: urlTab } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    setCurrentWorkspace,
    connectionStatus,
    setTaskPanelOpen,
    membersOpen,
    setMembersOpen,
    members: presenceMembers,
  } = useContext(AppContext);

  const [editor, setEditor] = useState(null);
  const [activeTool, setActiveTool] = useState("select");
  const [activeTab, setActiveTab] = useState(urlTab || "workspace");
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [workspaceRole, setWorkspaceRole] = useState("viewer");
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [execOpen, setExecOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [layersVersion, setLayersVersion] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [replayActive, setReplayActive] = useState(false);
  const replayState = useCanvasReplay({ 
    workspaceId, 
    onReplayActiveChange: setReplayActive 
  });

  const [showAddTask, setShowAddTask] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("todo");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [inviteLinkError, setInviteLinkError] = useState("");

  const collabUser = useMemo(() => {
    if (!currentUser?.id) return null;
    const uid = String(currentUser.id);
    const member = workspaceMembers.find((m) => String(m.userId) === uid);
    const name =
      (member?.displayName && String(member.displayName).trim()) ||
      member?.username ||
      currentUser.username ||
      "Collaborator";
    const color =
      typeof member?.color === "string" && member.color.trim()
        ? member.color.trim()
        : "#6366f1";
    return { id: uid, name, color };
  }, [currentUser, workspaceMembers]);

  const [events, setEvents] = useState([]);
  const [execTab, setExecTab] = useState("dashboard"); // "dashboard" | "timeline"

  const [taskFilter, setTaskFilter] = useState("all");
  const [showTaskFilter, setShowTaskFilter] = useState(false);
  const [activityFilter, setActivityFilter] = useState("all");
  const [showActivityFilter, setShowActivityFilter] = useState(false);

  // Load workspace metadata
  useEffect(() => {
    if (!getAccessToken()) {
      navigate("/login", { replace: true });
      return;
    }

    if (typeof setCurrentWorkspace === "function") {
      setCurrentWorkspace(workspaceId || null);
    }

    const inviteToken = new URLSearchParams(location.search).get("invite");

    async function loadWorkspace() {
      if (inviteToken) {
        try {
          await apiFetch("/api/workspaces/invite-links/accept", {
            method: "POST",
            body: JSON.stringify({ token: inviteToken }),
          });
          setInviteLinkError("");
          navigate(`/workspace/${workspaceId}`, { replace: true });
        } catch (error) {
          setInviteLinkError(
            error?.message || "Invite link is invalid or expired. Loading workspace anyway.",
          );
        }
      }

      try {
        const res = await apiFetch(`/api/workspaces/${workspaceId}`);
        if (res?.workspace?.name) setWorkspaceName(res.workspace.name);
        if (res?.workspace?.role) setWorkspaceRole(res.workspace.role);
        setWorkspaceMembers(res?.members || []);
      } catch (_error) {
        if (!inviteToken) {
          setInviteLinkError("");
        }
      }
    }

    loadWorkspace();

    getMe()
      .then((res) => {
        setCurrentUser(res?.user || null);
      })
      .catch(() => {});
  }, [workspaceId, setCurrentWorkspace, navigate, location.search]);

  // Sync editor tool with activeTool state
  useEffect(() => {
    if (editor && activeTool) {
      try {
        if (typeof editor.setTool === "function") {
          editor.setTool(activeTool);
        } else if (typeof editor.setCurrentTool === "function") {
          editor.setCurrentTool(activeTool);
        }
      } catch (err) {
        console.warn("[Workspace] Failed to set tool:", activeTool, err);
      }
    }
  }, [editor, activeTool]);

  const loadTasks = useCallback(() => {
    apiFetch(`/api/workspaces/${workspaceId}/tasks`)
      .then((res) => setTasks(res.tasks || []))
      .catch(() => {});
  }, [workspaceId]);

  const loadEvents = useCallback(() => {
    apiFetch(`/api/workspaces/${workspaceId}/events`)
      .then((res) => {
        if (res.events) {
          const sorted = [...res.events].sort((a, b) => b.sequenceNum - a.sequenceNum);
          setEvents(sorted);
        }
      })
      .catch(() => {});
  }, [workspaceId]);

  const getUsername = useCallback((userId) => {
    if (!userId) return "System";
    if (currentUser?.id === userId) return "You";
    const member = workspaceMembers.find(m => m.user?.id === userId || m.userId === userId);
    return member?.user?.username || member?.username || `User ${userId.substring(0, 4)}`;
  }, [currentUser, workspaceMembers]);

  const getEventAction = useCallback((event) => {
    const actions = {
      "canvas:node:create": "created a canvas node",
      "canvas:node:update": "updated a canvas node",
      "canvas:node:delete": "deleted a canvas node",
      "canvas:node:lock": "locked a canvas node",
      "canvas:node:unlock": "unlocked a canvas node",
      "canvas:node:permission:update": "changed node permissions",
      "canvas:intent:classified": `classified a node as ${event?.payload?.intent || "reference"}`,
    };

    return actions[event?.eventType] || "modified the workspace";
  }, []);

  const getIntentLabel = useCallback((intent) => {
    if (!intent) return null;
    const normalized = String(intent).toLowerCase();
    if (normalized === "action_item") return "Action item";
    if (normalized === "open_question") return "Open question";
    if (normalized === "decision") return "Decision";
    if (normalized === "reference") return "Reference";
    return normalized.replace(/_/g, " ");
  }, []);

  useEffect(() => {
    loadTasks();
    loadEvents();
  }, [loadTasks, loadEvents]);

  useEffect(() => {
    if (activeTab === "workspace" || activeTab === "board") {
      loadTasks();
    }
  }, [activeTab, loadTasks]);

  useEffect(() => {
    window.addEventListener("ligma:tasks-sync", loadTasks);
    return () => window.removeEventListener("ligma:tasks-sync", loadTasks);
  }, [loadTasks]);

  useEffect(() => {
    const interval = window.setInterval(loadTasks, 5000);
    return () => window.clearInterval(interval);
  }, [loadTasks]);

  // Poll events every 5 seconds
  useEffect(() => {
    const interval = setInterval(loadEvents, 5000);
    return () => clearInterval(interval);
  }, [loadEvents]);
  const reloadWorkspaceMembers = useCallback(async () => {
    const res = await apiFetch(`/api/workspaces/${workspaceId}`);
    if (res?.workspace?.role) setWorkspaceRole(res.workspace.role);
    setWorkspaceMembers(res?.members || []);
  }, [workspaceId]);

  useEffect(() => {
    function handleRoleUpdated(event) {
      if (event?.detail?.workspaceId && String(event.detail.workspaceId) !== String(workspaceId)) {
        return;
      }
      reloadWorkspaceMembers().catch(() => {});
    }

    window.addEventListener("ligma:role-updated", handleRoleUpdated);
    return () => window.removeEventListener("ligma:role-updated", handleRoleUpdated);
  }, [reloadWorkspaceMembers, workspaceId]);

  const handleInviteMember = useCallback(
    async ({ username, role }) => {
      await apiFetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "POST",
        body: JSON.stringify({ username, role }),
      });
      await reloadWorkspaceMembers();
    },
    [workspaceId, reloadWorkspaceMembers],
  );

  const handleChangeMemberRole = useCallback(
    async ({ userId, role }) => {
      await apiFetch(`/api/workspaces/${workspaceId}/roles/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await reloadWorkspaceMembers();
    },
    [workspaceId, reloadWorkspaceMembers],
  );
  const handleCreateInviteLink = useCallback(
    async ({ role }) => {
      const payload = await apiFetch(`/api/workspaces/${workspaceId}/invite-link`, {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      return payload;
    },
    [workspaceId],
  );

  const isViewer = workspaceRole === "viewer";
  const isReadOnlyMode = isViewer || replayActive;
  const canManageMembers = workspaceRole === "lead";

  const onlineUsers = Array.isArray(presenceMembers) ? presenceMembers : [];
  const onlineUserIds = onlineUsers
    .map((entry) => entry?.userId || entry?.user?.id)
    .filter(Boolean);
  const onlineUsernames = onlineUsers
    .map((entry) => entry?.username || entry?.user?.username || entry?.user?.name)
    .filter(Boolean);

  const handleToolSelect = useCallback((toolId) => {
    if (isReadOnlyMode) return;
    setActiveTool(toolId);
  }, [isReadOnlyMode]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (isReadOnlyMode) return;
    if (!newTaskTitle.trim()) return;

    setIsSubmittingTask(true);
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          status: newTaskStatus,
          priority: newTaskPriority,
        }),
      });
      setNewTaskTitle("");
      setNewTaskStatus("todo");
      setNewTaskPriority("medium");
      setShowAddTask(false);
      loadTasks();
    } catch (err) {
      console.error("Failed to add task:", err);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleUpdateTask = async (taskId, data) => {
    if (isReadOnlyMode) return;
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      loadTasks();
    } catch (err) {
      console.error("Failed to update task:", err);
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

  const jumpToNode = useCallback((nodeId) => {
    if (!editor || !nodeId) return;
    try {
      if (typeof editor.jumpToNode === "function") {
        editor.jumpToNode(nodeId);
        return;
      }
      const shape = editor.getShape(nodeId);
      if (!shape) return;
      const bounds = editor.getShapePageBounds(shape);
      if (bounds) {
        editor.zoomToBounds(bounds, { animation: { duration: 500 } });
        editor.select(nodeId);
      }
    } catch (e) {
      console.error("Jump to node failed:", e);
    }
  }, [editor]);

  useEffect(() => {
    if (editor) {
      editor.user.updateUserPreferences({ colorScheme: isDarkMode ? 'dark' : 'light' });
    }
  }, [editor, isDarkMode]);

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
            {["Workspace", "Board", "Timeline"].map((tab) => (
              <button
                key={tab}
                className={
                  "workspace-tab" +
                  (activeTab === tab.toLowerCase() ? " active" : "")
                }
                onClick={() => {
                  const newTab = tab.toLowerCase();
                  setActiveTab(newTab);
                  navigate(`/workspace/${workspaceId}/${newTab}`);
                }}
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

          <button className="ws-share-btn" onClick={() => setShareOpen(true)}>
            <FiShare2 size={12} style={{ marginRight: 4 }} />
            Share
          </button>
          <button className="ws-members-btn" onClick={() => setMembersOpen(true)}>
            <FiUsers size={12} style={{ marginRight: 4 }} />
            Members
          </button>
          <RoleBadge role={workspaceRole} />

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
      {inviteLinkError && (
        <div className="ws-toast ws-toast-error" role="alert">
          {inviteLinkError}
        </div>
      )}

      <div className="workspace-body">
        {activeTab === 'timeline' ? (
          <div className="ws-full-timeline" style={{ flex: 1, padding: 'var(--space-8)', overflowY: 'auto', background: 'var(--color-bg-base)' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Workspace Timeline</h2>
              <p style={{ color: 'var(--color-text-subtle)', marginBottom: '32px' }}>A complete, append-only history of all events in this workspace.</p>
              
              <div className="ws-timeline-track" style={{ position: 'relative', borderLeft: '2px solid var(--color-border)', marginLeft: '14px', paddingLeft: '32px' }}>
                {events.map((event) => {
                  const action = getEventAction(event);

                  return (
                    <div key={event.id} className="ws-timeline-item" style={{ position: 'relative', marginBottom: '32px' }}>
                      <div style={{ position: 'absolute', left: '-39px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--color-bg-base)' }} />
                      <div style={{ fontSize: '12px', color: 'var(--color-text-subtle)', marginBottom: '4px' }}>
                        Seq: {event.sequenceNum} • {new Date(event.createdAt).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '15px', color: 'var(--color-text)' }}>
                        <strong>{getUsername(event.userId)}</strong> {action}
                      </div>
                    </div>
                  );
                })}
                {events.length === 0 && (
                  <div style={{ color: 'var(--color-text-subtle)' }}>No events recorded.</div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'board' ? (
          <div className="ws-kanban-view">
            {['todo', 'doing', 'done'].map((status) => (
              <div key={status} className="ws-kanban-column">
                <div className="ws-kanban-column-header">
                  <h3>{status === 'doing' ? 'IN PROGRESS' : status.toUpperCase()}</h3>
                  <span className="ws-kanban-count">
                    {tasks.filter(t => t.status === (status === 'doing' ? 'doing' : status)).length}
                  </span>
                </div>
                <div className="ws-kanban-tasks">
                  {tasks
                    .filter(t => t.status === (status === 'doing' ? 'doing' : status))
                    .map((task) => (
                      <div 
                        key={task.id} 
                        className="ws-task-card kanban-card"
                        onClick={() => {
                          if (task.source_node_id) {
                            setActiveTab('workspace');
                            navigate(`/workspace/${workspaceId}/workspace`);
                            setTimeout(() => jumpToNode(task.source_node_id), 100);
                          }
                        }}
                        style={{ 
                          cursor: task.source_node_id ? 'pointer' : 'default',
                        }}
                      >
                        <div className="ws-task-card-header">
                          <div className="ws-task-header-left">
                            {task.priority && (
                              <span className={`ws-task-priority-badge ${task.priority}`}>
                                {task.priority}
                              </span>
                            )}
                            {task.intent ? (
                              <span className={`ws-task-intent-badge ${String(task.intent).toLowerCase()}`}>
                                {getIntentLabel(task.intent)}
                              </span>
                            ) : null}
                            {task.authorName ? (
                              <span className="ws-task-added-by">by {task.authorName}</span>
                            ) : null}
                          </div>
                          <span className={`ws-task-badge ${!task.source_node_id ? "manual" : "auto"}`}>
                            {!task.source_node_id ? "✦ Manual" : "✦ Canvas"}
                          </span>
                        </div>
                        <p className="ws-task-title" style={{ fontSize: '14px', marginBottom: '16px' }}>{task.title}</p>
                        <div className="ws-task-footer">
                          <span 
                            className={`ws-task-status ${task.status}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isReadOnlyMode) return;
                              const states = ['todo', 'doing', 'done'];
                              const current = task.status === 'in_progress' ? 'doing' : task.status;
                              const idx = states.indexOf(current);
                              const next = states[(idx + 1) % states.length];
                              handleUpdateTask(task.id, { status: next });
                            }}
                            style={{ cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
                            title={isReadOnlyMode ? "Read-only mode" : "Click to cycle status"}
                          >
                            {task.status === 'in_progress' ? 'Doing' : task.status}
                          </span>
                          <div className="ws-task-footer-actions">
                            <div className="ws-task-user-pip" title={getUsername(task.assignee_id)}>
                              {getUsername(task.assignee_id).charAt(0).toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  {tasks.filter(t => t.status === (status === 'doing' ? 'doing' : status)).length === 0 && (
                    <div className="ws-kanban-empty">No tasks in this column</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
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
                  disabled={isReadOnlyMode}
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
                  disabled={isReadOnlyMode}
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
                activeTool={activeTool}
                gridMode={gridEnabled}
                readOnly={isReadOnlyMode}
                currentUserId={currentUser?.id || null}
                currentUserRole={workspaceRole}
                collabUser={collabUser}
              />
              <ReplayOverlay state={replayState} gridMode={gridEnabled} />

              {layersOpen && !replayActive && (
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
                      .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
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
                        <span>{shape.type} - {(shape.id.split(':')[1] || shape.id).substring(0, 4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Toolbar Area */}
              <ReplayControls state={replayState} />
              <div className="ws-bottom-bar">
                <button 
                  className={`ws-bottom-btn${replayState.enabled ? " active" : ""}`}
                  title="Time Travel"
                  onClick={() => replayState.toggleEnabled()}
                >
                  <FiClock size={14} />
                </button>
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
                <button 
                  className={`ws-bottom-btn${isDarkMode ? " active" : ""}`} 
                  title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  onClick={() => setIsDarkMode(!isDarkMode)}
                >
                  {isDarkMode ? <FiMoon size={14} /> : <FiSun size={14} />}
                </button>
                <button 
                  className="ws-bottom-btn" 
                  title="Zoom Out"
                  onClick={() => editor?.zoomOut()}
                >
                  <FiZoomOut size={14} />
                </button>
                <button 
                  className="ws-bottom-btn" 
                  title="Zoom to Fit"
                  onClick={() => {
                    if (!editor) return;
                    try {
                      editor.zoomToFit({ animation: { duration: 500 } });
                    } catch (e) {
                      editor.resetZoom();
                    }
                  }}
                >
                  <FiCrosshair size={14} />
                </button>
                <button 
                  className="ws-bottom-btn" 
                  title="Zoom In"
                  onClick={() => editor?.zoomIn()}
                >
                  <FiZoomIn size={14} />
                </button>
              </div>
            </div>


            {/* Execution Panel (Right Sidebar) */}
        {execOpen && (
          <aside className="ws-exec-panel">
            <div className="ws-exec-scroll">
                  {/* Activity Log Section (Recent) */}
                  <div className="ws-section-toggle" style={{ position: 'relative' }}>
                    <h3>
                      <FiActivity size={12} />
                      Recent Activity
                    </h3>
                    <button 
                      className="ws-section-add-btn" 
                      aria-label="Filter events" 
                      title="Filter events"
                      onClick={() => setShowActivityFilter(!showActivityFilter)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '4px', 
                        width: 'auto', height: 'auto',
                        background: activityFilter !== 'all' ? 'rgba(13, 153, 255, 0.1)' : 'transparent', 
                        padding: activityFilter !== 'all' ? '4px 8px' : '4px', 
                        borderRadius: '4px' 
                      }}
                    >
                      {activityFilter !== 'all' && (
                        <span style={{ fontSize: '10px', color: 'var(--color-primary)', textTransform: 'capitalize', fontWeight: 600 }}>{activityFilter}</span>
                      )}
                      {activityFilter !== 'all' ? <FiFilter size={12} color="var(--color-primary)" /> : <FiMoreHorizontal size={12} />}
                    </button>
                    {showActivityFilter && (
                      <div className="ws-dropdown-menu">
                        {['all', 'mine', 'others'].map(filter => (
                          <button 
                            key={filter}
                            className={`ws-dropdown-item ${activityFilter === filter ? 'active' : ''}`}
                            onClick={() => { setActivityFilter(filter); setShowActivityFilter(false); }}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <ul className="ws-activity-list">
                    {events.filter(e => {
                      if (activityFilter === 'all') return true;
                      if (activityFilter === 'mine') return e.userId === currentUser?.id;
                      if (activityFilter === 'others') return e.userId !== currentUser?.id;
                      return true;
                    }).slice(0, 3).map((event) => {
                      const action = getEventAction(event);
                      return (
                        <li key={event.id} className="ws-activity-item">
                          <div
                            className="ws-activity-avatar"
                            style={{ background: "#A259FF" }}
                          >
                            {getUsername(event.userId).charAt(0).toUpperCase()}
                          </div>
                          <div className="ws-activity-body">
                            <p>
                              <strong>{getUsername(event.userId)}</strong> {action}
                            </p>
                            <div className="ws-activity-time">{new Date(event.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          </div>
                        </li>
                      );
                    })}
                    {events.length === 0 && (
                      <li className="ws-activity-item">
                        <div className="ws-activity-body">
                          <p style={{ color: 'var(--color-text-subtle)' }}>No activity yet.</p>
                        </div>
                      </li>
                    )}
                  </ul>

                  {/* Task Board Section */}
              <div className="ws-section-toggle" style={{ position: 'relative' }}>
                <h3>
                  <FiFileText size={12} />
                  Task Board
                </h3>
                <button 
                  className="ws-section-add-btn" 
                  aria-label="Filter tasks"
                  onClick={() => setShowTaskFilter(!showTaskFilter)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '4px', 
                    width: 'auto', height: 'auto',
                    background: taskFilter !== 'all' ? 'rgba(13, 153, 255, 0.1)' : 'transparent', 
                    padding: taskFilter !== 'all' ? '4px 8px' : '4px', 
                    borderRadius: '4px' 
                  }}
                >
                  {taskFilter !== 'all' && (
                    <span style={{ fontSize: '10px', color: 'var(--color-primary)', textTransform: 'capitalize', fontWeight: 600 }}>{taskFilter}</span>
                  )}
                  {taskFilter !== 'all' ? <FiFilter size={12} color="var(--color-primary)" /> : <FiMoreHorizontal size={12} />}
                </button>
                {showTaskFilter && (
                  <div className="ws-dropdown-menu">
                    {['all', 'todo', 'doing', 'done'].map(filter => (
                      <button 
                        key={filter}
                        className={`ws-dropdown-item ${taskFilter === filter ? 'active' : ''}`}
                        onClick={() => { setTaskFilter(filter); setShowTaskFilter(false); }}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="ws-task-section" style={{ paddingTop: '16px' }}>
                {tasks.filter(t => taskFilter === 'all' || t.status === taskFilter).length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "var(--space-6) 0",
                      color: "var(--color-text-subtle)",
                      fontSize: "var(--text-xs)",
                    }}
                  >
                    No tasks yet. Add text to a sticky note on the canvas; matching items sync here after a moment.
                  </div>
                )}

                {tasks.filter(t => taskFilter === 'all' || t.status === taskFilter).map((task) => (
                  <div 
                    key={task.id} 
                    className="ws-task-card"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeTab !== 'workspace') {
                        setActiveTab('workspace');
                        navigate(`/workspace/${workspaceId}/workspace`);
                        setTimeout(() => jumpToNode(task.source_node_id), 100);
                      } else {
                        jumpToNode(task.source_node_id);
                      }
                    }}
                    style={{ 
                      cursor: task.source_node_id ? 'pointer' : 'default',
                      transition: 'transform 0.2s, border-color 0.2s'
                    }}
                  >
                    <div className="ws-task-card-header">
                      <div className="ws-task-header-left">
                        {task.priority && (
                          <span className={`ws-task-priority-badge ${task.priority}`}>
                            {task.priority}
                          </span>
                        )}
                        {task.intent ? (
                          <span className={`ws-task-intent-badge ${String(task.intent).toLowerCase()}`}>
                            {getIntentLabel(task.intent)}
                          </span>
                        ) : null}
                        {task.authorName ? (
                          <span className="ws-task-added-by">{task.authorName}</span>
                        ) : null}
                      </div>
                      <span className={`ws-task-badge ${!task.source_node_id ? "manual" : "auto"}`}>
                        {!task.source_node_id ? "✦ Manual" : "✦ Canvas"}
                      </span>
                    </div>
                    <p className="ws-task-title">{task.title}</p>
                    <div className="ws-task-footer">
                      <span 
                        className={`ws-task-status ${task.status}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isReadOnlyMode) return;
                          const states = ['todo', 'doing', 'done'];
                          const current = task.status === 'in_progress' ? 'doing' : task.status;
                          const idx = states.indexOf(current);
                          const next = states[(idx + 1) % states.length];
                          handleUpdateTask(task.id, { status: next });
                        }}
                        style={{ cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
                        title={isReadOnlyMode ? "Read-only mode" : "Click to cycle status"}
                      >
                        {task.status === 'in_progress' ? 'Doing' : task.status}
                      </span>
                      <div className="ws-task-footer-actions">
                        {task.source_node_id && (
                          <button 
                            className="ws-task-link-btn" 
                            title="View on canvas"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeTab !== 'workspace') {
                                setActiveTab('workspace');
                                navigate(`/workspace/${workspaceId}/workspace`);
                                setTimeout(() => jumpToNode(task.source_node_id), 100);
                              } else {
                                jumpToNode(task.source_node_id);
                              }
                            }}
                          >
                            <FiLink size={10} />
                          </button>
                        )}
                        <div className="ws-task-user-pip" title={getUsername(task.assignee_id)}>
                          {getUsername(task.assignee_id).charAt(0).toUpperCase()}
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
                        disabled={isReadOnlyMode}
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
                              disabled={isReadOnlyMode}
                            >
                              {s === 'doing' ? 'Doing' : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="ws-form-row" style={{ marginTop: '16px' }}>
                      <div className="ws-field-group">
                        <label>Priority</label>
                        <div className="ws-status-toggle priority">
                          {['low', 'medium', 'high', 'urgent'].map((p) => (
                            <button
                              key={p}
                              type="button"
                              className={`${newTaskPriority === p ? 'active' : ''} ${p}`}
                              onClick={() => setNewTaskPriority(p)}
                              disabled={isReadOnlyMode}
                            >
                              {p.charAt(0).toUpperCase() + p.slice(1)}
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
                      disabled={isReadOnlyMode || isSubmittingTask || !newTaskTitle.trim()}
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
                disabled={isReadOnlyMode}
                title={isReadOnlyMode ? "Read-only mode" : "Add Task"}
              >
                <FiPlus size={14} />
                Add Task
              </button>
              <button className="ws-sprint-btn creative-glow" disabled={isReadOnlyMode}>
                <FiZap size={13} />
                Execute Sprint
              </button>
            </div>
          </aside>
        )}
      </>
        )}
      </div>
      <MembersSidebar
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        members={workspaceMembers}
        onlineUserIds={onlineUserIds}
        onlineUsernames={onlineUsernames}
        currentUserId={currentUser?.id || null}
        currentRole={workspaceRole}
        canManageMembers={canManageMembers}
        onChangeRole={handleChangeMemberRole}
      />
      <ShareWorkspaceModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onInvite={handleInviteMember}
        onCreateInviteLink={handleCreateInviteLink}
        canManageMembers={canManageMembers}
        onOpenMembers={() => {
          setShareOpen(false);
          setMembersOpen(true);
        }}
      />
    </div>
  );
}






