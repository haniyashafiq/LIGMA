import React from "react";
import { FiTrash2, FiLink } from "react-icons/fi";

export function TaskCard({ 
  task, 
  onUpdateTask, 
  onDeleteTask,
  onJumpToNode, 
  isReadOnlyMode, 
  getUsername, 
  getIntentLabel,
  onDragStart
}) {
  const getPriorityIcon = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '☰';
      case 'medium': return '☲';
      case 'low': return '☱';
      default: return '☲';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'done': return '●';
      case 'in_progress': return '◐';
      case 'todo': return '○';
      default: return '○';
    }
  };

  return (
    <div 
      className="ws-new-task-card"
      draggable={!isReadOnlyMode}
      onDragStart={(e) => {
        if (isReadOnlyMode) return;
        if (onDragStart) onDragStart(task);
      }}
      onClick={() => {
        if (task.source_node_id) {
          onJumpToNode(task.source_node_id);
        }
      }}
    >
      <div className="ws-task-top-row">
        <div className="ws-task-main-info">
          <h4 className="ws-task-display-title">{task.title?.replace(/^\[.*?\]\s*/, '')}</h4>
          <span className="ws-task-author-sub">by {task.authorName || 'unknown'}</span>
        </div>
        <div className="ws-task-top-badges">
          <span className={`ws-task-type-badge ${!task.source_node_id ? "manual" : "auto"}`}>
            {!task.source_node_id ? "✦ MANUAL" : "✦ CANVAS"}
          </span>
          {!isReadOnlyMode && onDeleteTask && (
            <button 
              className="ws-task-delete-action"
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

      <div className="ws-task-divider" />

      <div className="ws-task-bottom-row">
        <div className="ws-task-status-badges">
          <button 
            className={`ws-pill-badge status-${task.status}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isReadOnlyMode) return;
              const states = ['todo', 'in_progress', 'done'];
              const idx = states.indexOf(task.status);
              const next = states[(idx + 1) % states.length];
              onUpdateTask(task.id, { status: next });
            }}
          >
            <span className="pill-icon">{getStatusIcon(task.status)}</span>
            {task.status === 'in_progress' ? 'DOING' : task.status?.toUpperCase()}
          </button>

          <span className={`ws-pill-badge priority-${task.priority}`}>
            <span className="pill-icon">{getPriorityIcon(task.priority)}</span>
            {task.priority?.toUpperCase()}
          </span>

          {task.intent && (
            <span className={`ws-pill-badge intent-${String(task.intent).toLowerCase()}`}>
              {getIntentLabel(task.intent).toUpperCase()}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
