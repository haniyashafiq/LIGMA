import React from "react";

export function TaskCard({ 
  task, 
  onUpdateTask, 
  onJumpToNode, 
  isReadOnlyMode, 
  getUsername, 
  getIntentLabel 
}) {
  return (
    <div 
      className="ws-task-card kanban-card"
      onClick={() => {
        if (task.source_node_id) {
          onJumpToNode(task.source_node_id);
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
            onUpdateTask(task.id, { status: next });
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
  );
}
