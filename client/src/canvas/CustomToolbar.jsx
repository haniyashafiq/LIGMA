import React from "react";
import "../styles/canvas.css";

export default function CustomToolbar() {
  return (
    <div className="canvas-toolbar">
      <button className="tool-btn">Select</button>
      <button className="tool-btn">Sticky</button>
      <button className="tool-btn">Text</button>
      <button className="tool-btn">Draw</button>
      <button className="tool-btn">Shape</button>
      <div className="toolbar-spacer" />
      <button className="tool-btn">Tasks</button>
      <button className="tool-btn">Members</button>
    </div>
  );
}
