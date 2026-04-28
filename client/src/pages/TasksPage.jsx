import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { apiFetch } from "../net/api";
import { FiLink, FiCheckCircle, FiClock, FiAlertCircle, FiPlus } from "react-icons/fi";
import "../styles/workspace.css";

export function TasksPage({ user }) {
  const [tasks, setTasks] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [filterWorkspace, setFilterWorkspace] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showWsDropdown, setShowWsDropdown] = useState(false);

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

  const getInitials = (name) => {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  };

  return (
    <DashboardLayout user={user}>
      <header className="page-header">
        <div className="page-title">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <h1>Global Task Board</h1>
            
            <div className="ws-filter-wrap" style={{ position: 'relative' }}>
              <button 
                className="ws-board-select-btn"
                onClick={() => setShowWsDropdown(!showWsDropdown)}
              >
                {filterWorkspace === 'all' ? 'All Workspaces' : workspaces.find(w => w.id === filterWorkspace)?.name || 'Select Workspace'}
                <FiPlus size={12} style={{ transform: showWsDropdown ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              
              {showWsDropdown && (
                <div className="ws-board-dropdown glass-panel">
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
          <p>Unified view of your engineering initiatives across the platform.</p>
        </div>
      </header>

      {loading ? (
        <div className="ws-loading" style={{ marginTop: '100px' }}>
          <div className="ws-loading-spinner" />
          Loading global tasks...
        </div>
      ) : (
        <div className="ws-kanban-view" style={{ background: 'transparent', padding: '24px 0', height: 'calc(100vh - 200px)' }}>
            {['todo', 'doing', 'done'].map((status) => (
              <div key={status} className="ws-kanban-column" style={{ background: 'rgba(20, 20, 20, 0.4)', borderRadius: '16px' }}>
                <div className="ws-kanban-column-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3>{status === 'doing' ? 'IN PROGRESS' : status.toUpperCase()}</h3>
                    <span className="ws-kanban-count-pill">
                      {tasks.filter(t => (filterWorkspace === 'all' || t.workspace_id === filterWorkspace) && t.status === status).length}
                    </span>
                  </div>
                  <button className="ws-kanban-more"><FiPlus size={14} /></button>
                </div>
                <div className="ws-kanban-tasks">
                  {tasks
                    .filter(t => (filterWorkspace === 'all' || t.workspace_id === filterWorkspace) && t.status === status)
                    .map((task) => (
                      <div key={task.id} className={`ws-task-card kanban-card status-border-${task.status}`}>
                        <div className="ws-task-card-header">
                          <div className="ws-task-header-left">
                            {task.priority && (
                              <span className={`ws-task-priority-badge ${task.priority}`}>
                                {task.priority}
                              </span>
                            )}
                          </div>
                          <Link 
                            to={`/workspace/${task.workspace_id}/workspace`} 
                            className="ws-task-workspace-link"
                          >
                            {task.workspaceName}
                          </Link>
                        </div>
                        <p className="ws-task-title" style={{ fontSize: '13px', fontWeight: '500', lineHeight: '1.5', margin: '8px 0 12px' }}>{task.title}</p>
                        
                        <div className="ws-task-progress-mini">
                          <div className="ws-task-progress-bar">
                            <div className="ws-task-progress-fill" style={{ width: task.status === 'done' ? '100%' : task.status === 'doing' ? '50%' : '0%' }} />
                          </div>
                        </div>

                        <div className="ws-task-footer" style={{ marginTop: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-subtle)', fontSize: '10px' }}>
                             <FiCheckCircle size={10} />
                             <span>{task.status === 'done' ? '1/1' : '0/1'}</span>
                          </div>
                          <div className="ws-task-footer-actions">
                            <div className="ws-task-user-pip" title={task.authorName || "Unassigned"}>
                              {getInitials(task.authorName)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  {tasks.filter(t => (filterWorkspace === 'all' || t.workspace_id === filterWorkspace) && t.status === status).length === 0 && (
                    <div className="ws-kanban-empty">No tasks in this column</div>
                  )}
                </div>
                <button className="ws-kanban-add-btn">
                  <FiPlus size={14} />
                  Add Issue
                </button>
              </div>
            ))}
          </div>
        )}
    </DashboardLayout>
  );
}
