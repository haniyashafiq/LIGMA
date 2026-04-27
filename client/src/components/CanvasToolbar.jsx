import React from "react";
import "../styles/canvas.css";

export default function CanvasToolbar() {
  return (
    <div className="canvas-toolbar">
      <button className="tool-btn" title="Select">
        Select
      </button>
      <button className="tool-btn" title="Sticky">
        Sticky
      </button>
      <button className="tool-btn" title="Text">
        Text
      </button>
      <button className="tool-btn" title="Shape">
        Shape
      </button>
      <button className="tool-btn" title="Pen">
        Pen
      </button>
      <button className="tool-btn" title="Eraser">
        Eraser
      </button>
      <div className="toolbar-spacer" />
      <button className="tool-btn" title="Undo">
        ⤺
      </button>
      <button className="tool-btn" title="Redo">
        ⤻
      </button>
    </div>
  );
}
