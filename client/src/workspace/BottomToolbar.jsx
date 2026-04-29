import React from "react";
import { 
  FiClock, 
  FiRotateCcw, 
  FiRotateCw, 
  FiSquare, 
  FiMaximize, 
  FiMoon, 
  FiSun, 
  FiZoomOut, 
  FiCrosshair, 
  FiZoomIn 
} from "react-icons/fi";
import { ReplayControls } from "../components/CanvasReplay";

export function BottomToolbar({ 
  replayState, 
  gridEnabled, 
  setGridEnabled, 
  toggleFullScreen, 
  isDarkMode, 
  setIsDarkMode, 
  editor 
}) {
  return (
    <>
      <ReplayControls state={replayState} />
      <div className="ws-bottom-bar">
        <button
          className={`ws-bottom-btn${replayState.enabled ? " active" : ""}`}
          title="Time Travel"
          onClick={() => replayState.toggleEnabled()}
        >
          <FiClock size={14} />
        </button>
        <div className="ws-bottom-divider" />
        <button className="ws-bottom-btn" title="Undo">
          <FiRotateCcw size={14} />
        </button>
        <button className="ws-bottom-btn" title="Redo">
          <FiRotateCw size={14} />
        </button>
        <div className="ws-bottom-divider" />
        <button
          className={`ws-bottom-btn${gridEnabled ? " active" : ""}`}
          title="Toggle Grid"
          onClick={() => setGridEnabled(!gridEnabled)}
        >
          <FiSquare size={14} />
        </button>
        <button
          className="ws-bottom-btn"
          title="Toggle Fullscreen"
          onClick={toggleFullScreen}
        >
          <FiMaximize size={14} />
        </button>
        <button
          className={`ws-bottom-btn${isDarkMode ? " active" : ""}`}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          onClick={() => setIsDarkMode(!isDarkMode)}
        >
          {isDarkMode ? <FiMoon size={14} /> : <FiSun size={14} />}
        </button>
        <button
          className="ws-bottom-btn"
          title="Zoom Out"
          onClick={() => editor?.zoomOut()}
        >
          <FiZoomOut size={14} />
        </button>
        <button
          className="ws-bottom-btn"
          title="Zoom to Fit"
          onClick={() => {
            if (!editor) return;
            try {
              editor.zoomToFit({ animation: { duration: 500 } });
            } catch (e) {
              editor.resetZoom();
            }
          }}
        >
          <FiCrosshair size={14} />
        </button>
        <button
          className="ws-bottom-btn"
          title="Zoom In"
          onClick={() => editor?.zoomIn()}
        >
          <FiZoomIn size={14} />
        </button>
      </div>
    </>
  );
}
