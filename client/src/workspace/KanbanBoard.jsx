import React from "react";
import { TaskCard } from "./TaskCard";

export function KanbanBoard({ 
  tasks, 
  onUpdateTask, 
  onDeleteTask,
  onJumpToNode, 
  isReadOnlyMode, 
  getUsername, 
  getIntentLabel 
}) {
  const columns = ['todo', 'in_progress', 'done'];

  // Map status for display
  const getColumnTitle = (status) => {
    if (status === 'in_progress') return 'IN PROGRESS';
    return status.toUpperCase();
  };

  return (
    <div className="ws-kanban-view">
      {columns.map((status) => (
        <div key={status} className="ws-kanban-column">
          <div className="ws-kanban-column-header">
            <h3>{getColumnTitle(status)}</h3>
            <span className="ws-kanban-count">
              {tasks.filter(t => t.status === status).length}
            </span>
          </div>
          <div className="ws-kanban-tasks">
            {tasks
              .filter(t => t.status === status)
              .map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdateTask={onUpdateTask}
                  onDeleteTask={onDeleteTask}
                  onJumpToNode={onJumpToNode}
                  isReadOnlyMode={isReadOnlyMode}
                  getUsername={getUsername}
                  getIntentLabel={getIntentLabel}
                />
              ))}
            {tasks.filter(t => t.status === status).length === 0 && (
              <div className="ws-kanban-empty">No tasks in this column</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
