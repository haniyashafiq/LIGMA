import React, { useContext } from "react";
import { AppContext } from "../utils/AppContext";

export function TaskCard({ task }) {
  const { jumpToNode } = useContext(AppContext);

  function handleJump() {
    if (jumpToNode && task.sourceNodeId) {
      jumpToNode(task.sourceNodeId);
    }
  }

  return (
    <div className="task-card">
      <div className="task-card-header">
        <span className="task-intent-badge">{task.intent || "Task"}</span>
        <span className="task-author" title="Author">
          {task.authorName || "Unknown"}
        </span>
      </div>
      <div className="task-card-title">{task.title}</div>
      <div className="task-card-actions">
        {task.sourceNodeId && (
          <button className="task-jump-btn" onClick={handleJump}>
            Jump to Node
          </button>
        )}
      </div>
    </div>
  );
}
