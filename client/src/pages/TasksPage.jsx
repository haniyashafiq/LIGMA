import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { apiFetch } from "../net/api";
import { FiLink, FiCheckCircle, FiClock, FiAlertCircle, FiPlus, FiChevronDown } from "react-icons/fi";
import "../styles/workspace.css";
import { TaskCard } from "../workspace/TaskCard";

function normalizeBoardStatus(raw) {
  const s = (raw || "").toLowerCase();
  if (s === "doing") return "in_progress";
  return s;
}

export function TasksPage({ user }) {
  const [tasks, setTasks] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [filterWorkspace, setFilterWorkspace] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showWsDropdown, setShowWsDropdown] = useState(false);
  const [draggingTask, setDraggingTask] = useState(null);

  const loadTasks = useCallback(() => {
    apiFetch("/api/workspaces/all/tasks")
      .then((res) => {
        console.log("DEBUG: Global Tasks Response:", res);
        setTasks(res.tasks || []);
      })
      .catch((err) => console.error("Failed to load global tasks:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTasks();
    apiFetch("/api/workspaces")
      .then((res) => setWorkspaces(res.workspaces || []))
      .catch(() => {});
  }, [loadTasks]);

  const handleUpdateTask = async (workspaceId, taskId, data) => {
    // Optimistic Update
    const oldTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...data } : t));

    try {
      await apiFetch(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      // Optionally reload to ensure sync
      // loadTasks(); 
    } catch (err) {
      console.error("Failed to update task:", err);
      setTasks(oldTasks); // Rollback
      alert("Failed to update task status. Please try again.");
    }
  };

  const handleDeleteTask = async (workspaceId, taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    
    const oldTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
      await apiFetch(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
        method: "DELETE"
      });
    } catch (err) {
      console.error("Failed to delete task:", err);
      setTasks(oldTasks);
      alert("Failed to delete task. Please try again.");
    }
  };

  const getIntentLabel = (intent) => {
    switch (intent?.toLowerCase()) {
      case 'action_item': return 'Action Item';
      case 'open_question': return 'Open Question';
      case 'decision': return 'Decision';
      case 'reference': return 'Reference';
      default: return 'Task';
    }
  };

  const onDragStart = (task) => {
    setDraggingTask(task);
  };

  const onDragOver = (e) => {
    e.preventDefault(); // Allow drop
  };

  const onDrop = (newStatus) => {
    if (!draggingTask) return;
    const from = normalizeBoardStatus(draggingTask.status);
    if (from === newStatus) {
      setDraggingTask(null);
      return;
    }

    handleUpdateTask(draggingTask.workspace_id, draggingTask.id, { status: newStatus });
    setDraggingTask(null);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  };

  return (
    <DashboardLayout user={user}>
      <header className="page-header">
        <div className="page-title">
          <h1>Global Task Board</h1>
          <p>Unified view of your engineering initiatives across the platform.</p>
        </div>

        <div className="page-actions">
          <div className="ws-filter-wrap" style={{ position: 'relative' }}>
            <button 
              className="ws-board-select-btn"
              onClick={() => setShowWsDropdown(!showWsDropdown)}
              style={{ padding: '8px 16px', borderRadius: '10px' }}
            >
              <span style={{ opacity: 0.5, marginRight: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project:</span>
              {filterWorkspace === 'all' ? 'All Workspaces' : workspaces.find(w => w.id === filterWorkspace)?.name || 'Select Workspace'}
              <FiChevronDown size={14} style={{ transform: showWsDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.5 }} />
            </button>
            
            {showWsDropdown && (
              <div className="ws-board-dropdown glass-panel" style={{ right: 0, left: 'auto' }}>
                <div 
                  className={`ws-board-dropdown-item ${filterWorkspace === 'all' ? 'active' : ''}`}
                  onClick={() => { setFilterWorkspace('all'); setShowWsDropdown(false); }}
                >
                  All Workspaces
                </div>
                <div className="ws-board-dropdown-divider" />
                {workspaces.map(ws => (
                  <div 
                    key={ws.id}
                    className={`ws-board-dropdown-item ${filterWorkspace === ws.id ? 'active' : ''}`}
                    onClick={() => { setFilterWorkspace(ws.id); setShowWsDropdown(false); }}
                  >
                    {ws.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="ws-loading" style={{ marginTop: '100px' }}>
          <div className="ws-loading-spinner" />
          Loading global tasks...
        </div>
      ) : (
        <div className="ws-kanban-view" style={{ background: 'transparent', padding: '24px 0', height: 'calc(100vh - 200px)' }}>
            {[
              { key: 'todo', title: 'TODO' },
              { key: 'in_progress', title: 'IN PROGRESS' },
              { key: 'done', title: 'DONE' },
            ].map(({ key: status, title }) => (
              <div 
                key={status} 
                className={`ws-kanban-column column-${status}`} 
                style={{ background: 'rgba(20, 20, 20, 0.4)', borderRadius: '16px' }}
                onDragOver={onDragOver}
                onDrop={() => onDrop(status)}
              >
                <div className="ws-kanban-column-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3>{title}</h3>
                    <span className="ws-kanban-count-pill">
                      {tasks.filter(t => (filterWorkspace === 'all' || t.workspace_id === filterWorkspace) && normalizeBoardStatus(t.status) === status).length}
                    </span>
                  </div>
                  <button className="ws-kanban-more"><FiPlus size={14} /></button>
                </div>
                <div className="ws-kanban-tasks">
                  {tasks
                    .filter(t => (filterWorkspace === 'all' || t.workspace_id === filterWorkspace) && normalizeBoardStatus(t.status) === status)
                    .map((task) => (
                      <TaskCard 
                        key={task.id}
                        task={task}
                        onUpdateTask={(id, data) => handleUpdateTask(task.workspace_id, id, data)}
                        onDeleteTask={(id) => handleDeleteTask(task.workspace_id, id)}
                        onJumpToNode={(nodeId) => {
                          window.location.href = `/workspace/${task.workspace_id}/workspace`;
                        }}
                        getUsername={(id) => task.authorName || 'User'}
                        getIntentLabel={getIntentLabel}
                        isReadOnlyMode={false}
                        onDragStart={onDragStart}
                      />
                    ))}
                  {tasks.filter(t => (filterWorkspace === 'all' || t.workspace_id === filterWorkspace) && normalizeBoardStatus(t.status) === status).length === 0 && (
                    <div className="ws-kanban-empty">No tasks in this column</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </DashboardLayout>
  );
}
