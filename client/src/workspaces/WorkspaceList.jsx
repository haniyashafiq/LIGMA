import React, { useEffect, useState } from "react";
import "../styles/canvas.css";

export default function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    // placeholder: fetch from /api/workspaces
    setWorkspaces([
      { id: "ws1", name: "Project Alpha" },
      { id: "ws2", name: "Design Sprint" },
    ]);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Workspaces</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, 220px)",
          gap: 12,
        }}
      >
        {workspaces.map((w) => (
          <div key={w.id} className="workspace-card">
            <div className="workspace-card-title">{w.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
