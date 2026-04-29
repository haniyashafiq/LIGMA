import React from "react";
import { FiTrash2, FiLink } from "react-icons/fi";

export function TaskCard({ 
  task, 
  onUpdateTask, 
  onDeleteTask,
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
        </div>
        <div className="ws-task-header-right">
          <span className={`ws-task-badge ${!task.source_node_id ? "manual" : "auto"}`}>
            {!task.source_node_id ? "✦ Manual" : "✦ Canvas"}
          </span>
          {!isReadOnlyMode && onDeleteTask && (
            <button 
              className="ws-task-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(task.id);
              }}
              title="Delete task"
            >
              <FiTrash2 size={12} />
            </button>
          )}
        </div>
      </div>
      
      <p className="ws-task-title">{task.title}</p>
      
      {task.authorName && (
        <span className="ws-task-added-by">Added by {task.authorName}</span>
      )}

      <div className="ws-task-footer">
        <span 
          className={`ws-task-status ${task.status}`}
          onClick={(e) => {
            e.stopPropagation();
            if (isReadOnlyMode) return;
            const states = ['todo', 'in_progress', 'done'];
            const idx = states.indexOf(task.status);
            const next = states[(idx + 1) % states.length];
            onUpdateTask(task.id, { status: next });
          }}
          style={{ cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
          title={isReadOnlyMode ? "Read-only mode" : "Click to cycle status"}
        >
          {task.status === 'in_progress' ? 'In Progress' : (task.status.charAt(0).toUpperCase() + task.status.slice(1))}
        </span>
        
        <div className="ws-task-footer-actions">
          {task.source_node_id && (
            <button 
              className="ws-task-link-btn"
              title="Jump to Node"
              onClick={(e) => {
                e.stopPropagation();
                onJumpToNode(task.source_node_id);
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
  );
}
