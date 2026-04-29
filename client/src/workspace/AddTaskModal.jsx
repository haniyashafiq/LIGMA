import React from "react";
import { FiPlus } from "react-icons/fi";

export function AddTaskModal({ 
  showAddTask, 
  setShowAddTask, 
  handleAddTask, 
  newTaskTitle, 
  setNewTaskTitle, 
  newTaskStatus, 
  setNewTaskStatus, 
  newTaskPriority, 
  setNewTaskPriority, 
  isReadOnlyMode, 
  isSubmittingTask 
}) {
  if (!showAddTask) return null;

  return (
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
            {[
              { value: "todo", label: "Todo" },
              { value: "in_progress", label: "Doing" },
              { value: "done", label: "Done" },
            ].map(({ value, label }) => {
              const normalizedSelection =
                newTaskStatus === "doing" ? "in_progress" : newTaskStatus;
              return (
                <button
                  key={value}
                  type="button"
                  className={normalizedSelection === value ? "active" : ""}
                  onClick={() => setNewTaskStatus(value)}
                  disabled={isReadOnlyMode}
                >
                  {label}
                </button>
              );
            })}
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
  );
}
