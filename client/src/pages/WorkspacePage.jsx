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
  FiX,
  FiTrash,
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
  { id: "select", Icon: FiMousePointer, label: "Select", shortcut: "V" },
  { id: "hand", Icon: FiMove, label: "Hand", shortcut: "H / Space" },
  { id: "geo", Icon: FiSquare, label: "Shapes", shortcut: "S" },
  { id: "text", Icon: FiType, label: "Text", shortcut: "T" },
  { id: "draw", Icon: FiEdit2, label: "Pen", shortcut: "P" },
  { id: "arrow", Icon: FiArrowUpRight, label: "Arrow", shortcut: "A" },
  { id: "note", Icon: FiFileText, label: "Notes", shortcut: "N" },
  { id: "eraser", Icon: FiTrash, label: "Eraser", shortcut: "E" },
];

const TOOL_EXTRAS = [
  { id: "layers", Icon: FiLayers, label: "Layers" },
  { id: "clear_all", Icon: FiX, label: "Clear All" },
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
    members: presenceMembers,
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
  const [taskFilter, setTaskFilter] = useState("all");
  const [showTaskFilter, setShowTaskFilter] = useState(false);
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

  const handleDeleteAllTasks = useCallback(async () => {
    if (!window.confirm("Are you sure you want to delete ALL tasks in this workspace? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/tasks`, {
        method: "DELETE",
      });
      loadTasks();
    } catch (err) {
      console.error("Failed to delete all tasks:", err);
    }
  }, [workspaceId, loadTasks]);

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

  const [previousToolBeforeSpace, setPreviousToolBeforeSpace] = useState(null);

  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (workspaceRole === "viewer") return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
        return;
      }

      if (e.code === "Space" && activeTool !== "hand" && !previousToolBeforeSpace) {
        setPreviousToolBeforeSpace(activeTool);
        setActiveTool("hand");
        return;
      }

      const key = e.key.toLowerCase();
      const maps = {
        v: "select",
        h: "hand",
        s: "geo",
        t: "text",
        p: "draw",
        a: "arrow",
        n: "note",
        e: "eraser",
      };

      if (maps[key]) {
        e.preventDefault();
        handleToolSelect(maps[key]);
      }
    }

    function handleGlobalKeyUp(e) {
      if (e.code === "Space" && previousToolBeforeSpace) {
        setActiveTool(previousToolBeforeSpace);
        setPreviousToolBeforeSpace(null);
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("keyup", handleGlobalKeyUp);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("keyup", handleGlobalKeyUp);
    };
  }, [workspaceRole, handleToolSelect, activeTool, previousToolBeforeSpace]);

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
    
    // Optimistic Update
    const oldTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...data } : t));

    try {
      await apiFetch(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      // Optionally reload to ensure perfect sync
      // loadTasks(); 
    } catch (err) {
      console.error("Failed to update task:", err);
      setTasks(oldTasks); // Rollback on failure
      alert("Failed to update task. Please check your connection.");
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

  useEffect(() => {
    window.addEventListener("ligma:tasks-sync", loadTasks);
    return () => window.removeEventListener("ligma:tasks-sync", loadTasks);
  }, [loadTasks]);

  const isReadOnlyMode = workspaceRole === "viewer";
  const connectionDot = connectionStatus === "online" ? "online" : connectionStatus === "error" ? "error" : "offline";

  const handleUpdateMemberRole = async ({ userId, role }) => {
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      // Refresh members
      const res = await apiFetch(`/api/workspaces/${workspaceId}`);
      setWorkspaceMembers(res?.members || []);
    } catch (err) {
      console.error("Failed to update role:", err);
      throw err;
    }
  };

  const handleInviteMember = async ({ username, role }) => {
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({ username, role }),
      });
      // Refresh members
      const res = await apiFetch(`/api/workspaces/${workspaceId}`);
      setWorkspaceMembers(res?.members || []);
    } catch (err) {
      console.error("Failed to invite member:", err);
      throw err;
    }
  };

  const handleCreateInviteLink = async ({ role }) => {
    try {
      return await apiFetch(`/api/workspaces/${workspaceId}/invite-links`, {
        method: "POST",
        body: JSON.stringify({ role }),
      });
    } catch (err) {
      console.error("Failed to create invite link:", err);
      throw err;
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (workspaceRole === "viewer") return;
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: "DELETE",
      });
      loadTasks();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  return (
    <div className="ws-main-shell glassmorphism">
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
        presenceMembers={presenceMembers}
        currentUserId={currentUser?.id}
        canvasController={editor}
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
            onDeleteTask={handleDeleteTask}
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
              workspaceRole={workspaceRole}
              editor={editor}
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
                tasks={tasks}
                taskFilter={taskFilter}
                setTaskFilter={setTaskFilter}
                showTaskFilter={showTaskFilter}
                setShowTaskFilter={setShowTaskFilter}
                handleUpdateTask={handleUpdateTask}
                setShowAddTask={setShowAddTask}
                jumpToNode={jumpToNode}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                navigate={navigate}
                workspaceId={workspaceId}
                isReadOnlyMode={isReadOnlyMode}
                getIntentLabel={getIntentLabel}
                handleDeleteTask={handleDeleteTask}
                handleDeleteAllTasks={handleDeleteAllTasks}
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

      {membersOpen && (
        <MembersSidebar 
          open={true}
          workspaceId={workspaceId} 
          onClose={() => setMembersOpen(false)} 
          members={workspaceMembers}
          onlineUserIds={presenceMembers.map(m => m.id)}
          onlineUsernames={presenceMembers.map(m => m.name)}
          currentUserId={currentUser?.id}
          currentRole={workspaceRole}
          onChangeRole={handleUpdateMemberRole}
        />
      )}
      {shareOpen && (
        <ShareWorkspaceModal 
          open={true}
          workspaceId={workspaceId} 
          onClose={() => setShareOpen(false)} 
          onInvite={handleInviteMember}
          onCreateInviteLink={handleCreateInviteLink}
          canManageMembers={workspaceRole === 'lead'}
          onOpenMembers={() => { setShareOpen(false); setMembersOpen(true); }}
        />
      )}
    </div>
  );
}
