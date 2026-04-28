import React, { useContext } from "react";
import "../styles/canvas.css";
import { AppContext } from "../utils/AppContext";

export default function CustomToolbar({ editor, workspaceRole }) {
  const {
    taskPanelOpen,
    setTaskPanelOpen,
    setMembersOpen,
    timeTravelOpen,
    setTimeTravelOpen,
  } = useContext(AppContext);

  const role = workspaceRole || "viewer";
  const isViewer = role === "viewer";

  function toggleTaskPanel() {
    setTaskPanelOpen(!taskPanelOpen);
  }

  function toggleMembers() {
    setMembersOpen((v) => !v);
  }

  function toggleTimeTravel() {
    setTimeTravelOpen((v) => !v);
  }

  function selectTool(tool) {
    try {
      if (editor && typeof editor.setCurrentTool === "function") {
        editor.setCurrentTool(tool);
        return;
      }

      console.debug("[CustomToolbar] tool switch not available", tool);
    } catch (e) {
      console.error("[CustomToolbar] failed to select tool", e);
    }
  }

  return (
    <div className="canvas-toolbar">
      <button className="tool-btn" onClick={() => selectTool("select")}>
        Select
      </button>
      {!isViewer ? (
        <>
          <button className="tool-btn" onClick={() => selectTool("note")}>
            Sticky
          </button>
          <button className="tool-btn" onClick={() => selectTool("text")}>
            Text
          </button>
          <button className="tool-btn" onClick={() => selectTool("draw")}>
            Draw
          </button>
          <button className="tool-btn" onClick={() => selectTool("geo")}>
            Shape
          </button>
        </>
      ) : null}
      <div className="toolbar-spacer" />
      <button className="tool-btn" onClick={toggleTaskPanel}>
        {taskPanelOpen ? "Close Tasks" : "Tasks"}
      </button>
      <button className="tool-btn" onClick={toggleMembers}>
        Members
      </button>
      <button
        className={`tool-btn ${timeTravelOpen ? "tool-btn-active" : ""}`}
        onClick={toggleTimeTravel}
      >
        History
      </button>
    </div>
  );
}
