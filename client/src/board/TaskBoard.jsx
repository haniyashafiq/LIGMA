import React, { useContext } from "react";
import { AppContext } from "../utils/AppContext";
import { TaskCard } from "./TaskCard";
import "../styles/board.css";

// This is a basic scaffold for the Phase 6 Task Board.
// The actual Drag and Drop logic (@dnd-kit/core) and real-time socket connections 
// will be implemented in Phase 6.

export function TaskBoard({ workspaceId }) {
  const { taskPanelOpen, setTaskPanelOpen } = useContext(AppContext);

  // Mock tasks for scaffolding
  const tasks = [
    { id: "1", title: "Fix login layout", intent: "action_item", status: "TODO", authorName: "Alice" },
    { id: "2", title: "Review database schema", intent: "action_item", status: "DOING", authorName: "Bob" },
    { id: "3", title: "Update README", intent: "action_item", status: "DONE", authorName: "Charlie" },
  ];

  if (!taskPanelOpen) return null;

  return (
    <div className="taskboard-overlay">
      <div className="taskboard-header">
        <h2>Task Board</h2>
        <button className="tool-btn" onClick={() => setTaskPanelOpen(false)}>
          Close
        </button>
      </div>

      <div className="taskboard-columns">
        <div className="task-column">
          <h3>TODO</h3>
          {tasks.filter((t) => t.status === "TODO").map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>

        <div className="task-column">
          <h3>DOING</h3>
          {tasks.filter((t) => t.status === "DOING").map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>

        <div className="task-column">
          <h3>DONE</h3>
          {tasks.filter((t) => t.status === "DONE").map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>
    </div>
  );
}
