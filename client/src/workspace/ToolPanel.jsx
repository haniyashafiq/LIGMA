import React from "react";
import { FiSquare, FiCircle, FiTriangle } from "react-icons/fi";

export function ToolPanel({ 
  tools, 
  extras = [],
  activeTool, 
  handleToolSelect, 
  geoSubTool, 
  setGeoSubTool, 
  isReadOnlyMode,
  layersOpen,
  setLayersOpen
}) {
  return (
    <div className="ws-tool-panel">
      <span className="ws-tool-panel-label">Tools</span>

      {tools.map(({ id, Icon, label }) => (
        <React.Fragment key={id}>
          <button
            className={`ws-tool-btn${activeTool === id ? " active" : ""}`}
            onClick={() => handleToolSelect(id)}
            title={label}
            aria-label={label}
            disabled={isReadOnlyMode}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>

          {id === "geo" && activeTool === "geo" && (
            <div className="ws-tool-submenu">
              {[
                { id: "rect", Icon: FiSquare, label: "Rectangle" },
                { id: "circle", Icon: FiCircle, label: "Circle" },
                { id: "triangle", Icon: FiTriangle, label: "Triangle" },
              ].map((sub) => (
                <button
                  key={sub.id}
                  className={`ws-tool-sub-btn${geoSubTool === sub.id ? " active" : ""}`}
                  onClick={() => setGeoSubTool(sub.id)}
                  title={sub.label}
                >
                  <sub.Icon size={12} />
                </button>
              ))}
            </div>
          )}
        </React.Fragment>
      ))}

      <div className="ws-tool-divider" />

      {extras.map(({ id, Icon, label }) => (
        <button
          key={id}
          className={`ws-tool-btn${id === "layers" && layersOpen ? " active" : ""}`}
          title={label}
          aria-label={label}
          onClick={() => {
            if (id === "layers") setLayersOpen(!layersOpen);
          }}
          disabled={isReadOnlyMode}
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
