import React from "react";
import { FiTrash2 } from "react-icons/fi";

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
  const normalizedStatus = React.useMemo(() => {
    const s = task.status?.toLowerCase?.() || "todo";
    if (s === "doing") return "in_progress";
    return ["todo", "in_progress", "done"].includes(s) ? s : "todo";
  }, [task.status]);

  const getPriorityIcon = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high": return "☰";
      case "medium": return "☲";
      case "urgent": return "☷";
      case "low": return "☱";
      default: return "☲";
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case "done":
        return "●";
      case "in_progress":
        return "◐";
      case "todo":
        return "○";
      default:
        return "○";
    }
  };

  const statusClass = normalizedStatus.replace(/-/g, "_");

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
            type="button"
            className={`ws-pill-badge status-${statusClass}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isReadOnlyMode) return;
              const states = ["todo", "in_progress", "done"];
              const idx = Math.max(0, states.indexOf(normalizedStatus));
              const next = states[(idx + 1) % states.length];
              onUpdateTask(task.id, { status: next });
            }}
          >
            <span className="pill-icon">{getStatusIcon(normalizedStatus)}</span>
            {normalizedStatus === "in_progress" ? "DOING" : normalizedStatus?.toUpperCase()}
          </button>

          <button
            type="button"
            className={`ws-pill-badge priority-${task.priority || "medium"}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isReadOnlyMode) return;
              const order = ["low", "medium", "high", "urgent"];
              const current = task.priority?.toLowerCase?.() || "medium";
              const idx = Math.max(0, order.indexOf(current));
              const next = order[(idx + 1) % order.length];
              onUpdateTask(task.id, { priority: next });
            }}
          >
            <span className="pill-icon">{getPriorityIcon(task.priority)}</span>
            {task.priority?.toUpperCase()}
          </button>

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
