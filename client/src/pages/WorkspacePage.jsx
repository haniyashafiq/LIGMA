import React, { useContext, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import CanvasView from "../components/CanvasView";
import { TaskBoard } from "../board/TaskBoard";
import { AppContext } from "../utils/AppContext";

export function WorkspacePage() {
  const { workspaceId } = useParams();
  const { setCurrentWorkspace } = useContext(AppContext);

  useEffect(() => {
    if (typeof setCurrentWorkspace === "function") {
      setCurrentWorkspace(workspaceId || null);
    }
  }, [workspaceId, setCurrentWorkspace]);

  return (
    <main className="workspace-canvas-shell" style={{ position: "relative" }}>
      <header className="workspace-header panel">
        <div>
          <p className="section-label">Canvas Workspace</p>
          <h1>Workspace {workspaceId}</h1>
          <p className="muted-text">
            tldraw is mounted with the multiplayer sync room for this workspace.
          </p>
        </div>

        <Link className="secondary-button" to="/workspaces">
          Back to workspaces
        </Link>
      </header>

      <section className="canvas-stage panel">
        <CanvasView workspaceId={workspaceId} />
        <TaskBoard workspaceId={workspaceId} />
      </section>
    </main>
  );
}
