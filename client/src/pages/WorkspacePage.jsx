import React from "react";
import { Link, useParams } from "react-router-dom";
import { Tldraw } from "tldraw";

export function WorkspacePage() {
  const { workspaceId } = useParams();

  return (
    <main className="workspace-canvas-shell">
      <header className="workspace-header panel">
        <div>
          <p className="section-label">Canvas Workspace</p>
          <h1>Workspace {workspaceId}</h1>
          <p className="muted-text">
            tldraw is mounted locally here. Yjs sync wiring comes next.
          </p>
        </div>

        <Link className="secondary-button" to="/workspaces">
          Back to workspaces
        </Link>
      </header>

      <section className="canvas-stage panel">
        <Tldraw />
      </section>
    </main>
  );
}
