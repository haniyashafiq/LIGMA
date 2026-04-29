import React, { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  FiSquare,
  FiPlus,
  FiMousePointer,
  FiMove,
  FiType,
  FiEdit2,
  FiArrowUpRight,
  FiFileText,
  FiTrash2,
  FiLayers,
  FiSettings,
} from "react-icons/fi";
import CanvasView from "../components/CanvasView";
import { useCanvasReplay, ReplayOverlay } from "../components/CanvasReplay";
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
import "../styles/workspace.css";

// Modular Components
import { KanbanBoard } from "../workspace/KanbanBoard";
import { TimelineView } from "../workspace/TimelineView";
import { WorkspaceTopbar } from "../workspace/WorkspaceTopbar";
import { ToolPanel } from "../workspace/ToolPanel";
import { BottomToolbar } from "../workspace/BottomToolbar";
import { ExecutionPanel } from "../workspace/ExecutionPanel";
import { AddTaskModal } from "../workspace/AddTaskModal";

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

export function WorkspacePage() {
  const { workspaceId, tab: urlTab } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    setCurrentWorkspace,
    connectionStatus,
    membersOpen,
    setMembersOpen,
  } = useContext(AppContext);

  const [editor, setEditor] = useState(null);
  const [activeTool, setActiveTool] = useState("select");
  const [geoSubTool, setGeoSubTool] = useState("rect");
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
  const [activityFilter, setActivityFilter] = useState("all");
  const [showActivityFilter, setShowActivityFilter] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

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
        if (!inviteToken) setInviteLinkError("");
      }
    }

    loadWorkspace();

    getMe()
      .then((res) => setCurrentUser(res?.user || null))
      .catch(() => { });
  }, [workspaceId, setCurrentWorkspace, navigate, location.search]);

  useEffect(() => {
    if (editor && activeTool) {
      try {
        if (typeof editor.setTool === "function") {
          editor.setTool(activeTool === "geo" ? `geo:${geoSubTool}` : activeTool);
        }
      } catch (err) {
        console.warn("[Workspace] Failed to set tool:", activeTool, err);
      }
    }
  }, [editor, activeTool, geoSubTool]);

  const loadTasks = useCallback(() => {
    apiFetch(`/api/workspaces/${workspaceId}/tasks`)
      .then((res) => setTasks(res.tasks || []))
      .catch(() => { });
  }, [workspaceId]);

  const loadEvents = useCallback(() => {
    apiFetch(`/api/workspaces/${workspaceId}/events`)
      .then((res) => {
        if (res.events) {
          const sorted = [...res.events].sort((a, b) => b.sequenceNum - a.sequenceNum);
          setEvents(sorted);
        }
      })
      .catch(() => { });
  }, [workspaceId]);

  const getUsername = useCallback((userId) => {
    if (!userId) return "System";
    if (currentUser?.id === userId) return "You";
    const member = workspaceMembers.find(m => m.user?.id === userId || m.userId === userId);
    return member?.user?.username || member?.username || `User ${String(userId).substring(0, 4)}`;
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
    return intent;
  }, []);

  const handleLogout = () => {
    logout();
    clearAccessToken();
    navigate("/login");
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const handleToolSelect = useCallback((toolId) => {
    if (workspaceRole === "viewer") return;
    setActiveTool(toolId);
  }, [workspaceRole]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (workspaceRole === "viewer" || !newTaskTitle.trim()) return;
    setIsSubmittingTask(true);
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          status: newTaskStatus,
          priority: newTaskPriority,
          authorName: currentUser?.username || "Collaborator"
        }),
      });
      setNewTaskTitle("");
      setShowAddTask(false);
      loadTasks();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleUpdateTask = async (taskId, data) => {
    if (workspaceRole === "viewer") return;
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
    setEditor(editorInstance);
    editorInstance.on("change", () => setLayersVersion((v) => v + 1));
  }, []);

  const jumpToNode = useCallback((nodeId) => {
    if (!editor || !nodeId) return;
    try {
      if (typeof editor.jumpToNode === "function") {
        editor.jumpToNode(nodeId);
      } else {
        editor.zoomToSelection();
      }
    } catch (e) {
      console.error("Jump to node failed:", e);
    }
  }, [editor]);

  useEffect(() => {
    if (editor) {
      editor.user.updateUserPreferences({ colorScheme: isDarkMode ? 'dark' : 'light' });
    }
  }, [isDarkMode, editor]);

  useEffect(() => {
    loadTasks();
    loadEvents();
    const interval = setInterval(() => {
      loadTasks();
      loadEvents();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadTasks, loadEvents]);

  const isReadOnlyMode = workspaceRole === "viewer";
  const connectionDot = connectionStatus === "online" ? "online" : connectionStatus === "error" ? "error" : "offline";

  return (
    <div className="workspace-shell glassmorphism">
      <WorkspaceTopbar
        workspaceName={workspaceName}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        workspaceId={workspaceId}
        navigate={navigate}
        setShareOpen={setShareOpen}
        setMembersOpen={setMembersOpen}
        workspaceRole={workspaceRole}
        connectionDot={connectionDot}
        connectionStatus={connectionStatus}
        setExecOpen={setExecOpen}
        handleLogout={handleLogout}
      />

      {inviteLinkError && <div className="ws-toast ws-toast-error">{inviteLinkError}</div>}

      <div className="workspace-body">
        {activeTab === 'timeline' ? (
          <TimelineView events={events} getEventAction={getEventAction} getUsername={getUsername} />
        ) : activeTab === 'board' ? (
          <KanbanBoard 
            tasks={tasks} 
            onUpdateTask={handleUpdateTask} 
            onJumpToNode={(nodeId) => {
              if (activeTab !== 'workspace') {
                setActiveTab('workspace');
                navigate(`/workspace/${workspaceId}/workspace`);
                setTimeout(() => jumpToNode(nodeId), 100);
              } else {
                jumpToNode(nodeId);
              }
            }}
            isReadOnlyMode={isReadOnlyMode} 
            getUsername={getUsername} 
            getIntentLabel={getIntentLabel} 
          />
        ) : (
          <>
            <ToolPanel 
              tools={TOOLS} 
              extras={TOOL_EXTRAS}
              activeTool={activeTool} 
              handleToolSelect={handleToolSelect} 
              geoSubTool={geoSubTool} 
              setGeoSubTool={setGeoSubTool} 
              isReadOnlyMode={isReadOnlyMode} 
              layersOpen={layersOpen}
              setLayersOpen={setLayersOpen}
            />

            <div className="ws-canvas-area">
              <CanvasView
                workspaceId={workspaceId}
                token={getAccessToken()}
                onMount={onCanvasMount}
                gridMode={gridEnabled}
                readOnly={isReadOnlyMode}
                currentUserId={currentUser?.id || null}
                currentUserRole={workspaceRole}
                collabUser={collabUser}
                activeTool={activeTool === "geo" ? `geo:${geoSubTool}` : activeTool}
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
                    {editor && [...editor.getCurrentPageShapes()]
                      .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
                      .map(shape => (
                        <div key={shape.id} className="ws-layer-item" onClick={() => { editor.select(shape.id); editor.zoomToSelection(); }}>
                          <FiSquare size={12} />
                          <span>{shape.type} - {(shape.id.split(':')[1] || shape.id).substring(0, 4)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <BottomToolbar 
                replayState={replayState} 
                gridEnabled={gridEnabled} 
                setGridEnabled={setGridEnabled} 
                toggleFullScreen={toggleFullScreen} 
                isDarkMode={isDarkMode} 
                setIsDarkMode={setIsDarkMode} 
                editor={editor} 
              />
            </div>

            {execOpen && (
              <ExecutionPanel 
                events={events} 
                activityFilter={activityFilter} 
                setActivityFilter={setActivityFilter} 
                showActivityFilter={showActivityFilter} 
                setShowActivityFilter={setShowActivityFilter} 
                currentUser={currentUser} 
                getEventAction={getEventAction} 
                getUsername={getUsername} 
              />
            )}
          </>
        )}
      </div>

      <AddTaskModal 
        showAddTask={showAddTask} 
        setShowAddTask={setShowAddTask} 
        handleAddTask={handleAddTask} 
        newTaskTitle={newTaskTitle} 
        setNewTaskTitle={setNewTaskTitle} 
        newTaskStatus={newTaskStatus} 
        setNewTaskStatus={setNewTaskStatus} 
        newTaskPriority={newTaskPriority} 
        setNewTaskPriority={setNewTaskPriority} 
        isReadOnlyMode={isReadOnlyMode} 
        isSubmittingTask={isSubmittingTask} 
      />

      {membersOpen && <MembersSidebar workspaceId={workspaceId} onClose={() => setMembersOpen(false)} />}
      {shareOpen && <ShareWorkspaceModal workspaceId={workspaceId} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
