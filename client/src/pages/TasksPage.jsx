import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { apiFetch } from "../net/api";
import { FiLink, FiCheckCircle, FiClock, FiAlertCircle } from "react-icons/fi";
import "../styles/workspace.css";

export function TasksPage({ user }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(() => {
    apiFetch("/api/workspaces/all/tasks")
      .then((res) => setTasks(res.tasks || []))
      .catch((err) => console.error("Failed to load global tasks:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTasks();
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
          <h1>Global Task Board</h1>
          <p>All active tasks across your workspaces.</p>
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
              <div key={status} className="ws-kanban-column" style={{ background: 'var(--color-bg-raised)' }}>
                <div className="ws-kanban-column-header">
                  <h3>{status === 'doing' ? 'IN PROGRESS' : status.toUpperCase()}</h3>
                  <span className="ws-kanban-count">
                    {tasks.filter(t => t.status === status).length}
                  </span>
                </div>
                <div className="ws-kanban-tasks">
                  {tasks
                    .filter(t => t.status === status)
                    .map((task) => (
                      <div key={task.id} className="ws-task-card kanban-card">
                        <div className="ws-task-card-header">
                          <div className="ws-task-header-left">
                            {task.priority && (
                              <span className={`ws-task-priority-badge ${task.priority}`}>
                                {task.priority}
                              </span>
                            )}
                            <span className="ws-task-added-by" style={{ color: 'var(--color-primary)' }}>
                              {task.workspaceName}
                            </span>
                          </div>
                          <Link 
                            to={`/workspace/${task.workspace_id}/workspace`} 
                            className="ws-task-badge auto"
                            style={{ textDecoration: 'none' }}
                          >
                            ✦ Open
                          </Link>
                        </div>
                        <p className="ws-task-title" style={{ fontSize: '14px', marginBottom: '16px' }}>{task.title}</p>
                        <div className="ws-task-footer">
                          <span 
                            className={`ws-task-status ${task.status}`}
                            onClick={() => {
                              const states = ['todo', 'doing', 'done'];
                              const current = task.status === 'in_progress' ? 'doing' : task.status;
                              const idx = states.indexOf(current);
                              const next = states[(idx + 1) % states.length];
                              handleUpdateTask(task.workspace_id, task.id, { status: next });
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {task.status === 'in_progress' ? 'Doing' : task.status}
                          </span>
                          <div className="ws-task-footer-actions">
                            <div className="ws-task-user-pip" title={task.authorName || "Unassigned"}>
                              {getInitials(task.authorName)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  {tasks.filter(t => t.status === status).length === 0 && (
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
