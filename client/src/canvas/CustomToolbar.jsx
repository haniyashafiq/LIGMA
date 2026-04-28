import React, { useContext } from "react";
import "../styles/canvas.css";
import { AppContext } from "../utils/AppContext";

export default function CustomToolbar({ editor }) {
  const { taskPanelOpen, setTaskPanelOpen, setMembersOpen } =
    useContext(AppContext);

  function toggleTaskPanel() {
    setTaskPanelOpen(!taskPanelOpen);
  }

  function toggleMembers() {
    setMembersOpen((v) => !v);
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
      <div className="toolbar-spacer" />
      <button className="tool-btn" onClick={toggleTaskPanel}>
        {taskPanelOpen ? "Close Tasks" : "Tasks"}
      </button>
      <button className="tool-btn" onClick={toggleMembers}>
        Members
      </button>
    </div>
  );
}
