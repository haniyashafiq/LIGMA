import React from "react";
import { TaskCard } from "./TaskCard";

export function KanbanBoard({ 
  tasks, 
  onUpdateTask, 
  onJumpToNode, 
  isReadOnlyMode, 
  getUsername, 
  getIntentLabel 
}) {
  const columns = ['todo', 'doing', 'done'];

  return (
    <div className="ws-kanban-view">
      {columns.map((status) => (
        <div key={status} className="ws-kanban-column">
          <div className="ws-kanban-column-header">
            <h3>{status === 'doing' ? 'IN PROGRESS' : status.toUpperCase()}</h3>
            <span className="ws-kanban-count">
              {tasks.filter(t => t.status === (status === 'doing' ? 'doing' : status)).length}
            </span>
          </div>
          <div className="ws-kanban-tasks">
            {tasks
              .filter(t => t.status === (status === 'doing' ? 'doing' : status))
              .map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdateTask={onUpdateTask}
                  onJumpToNode={onJumpToNode}
                  isReadOnlyMode={isReadOnlyMode}
                  getUsername={getUsername}
                  getIntentLabel={getIntentLabel}
                />
              ))}
            {tasks.filter(t => t.status === (status === 'doing' ? 'doing' : status)).length === 0 && (
              <div className="ws-kanban-empty">No tasks in this column</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
