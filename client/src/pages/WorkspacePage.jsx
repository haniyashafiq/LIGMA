import React, { useContext, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import CanvasView from "../components/CanvasView";
import { TaskBoard } from "../board/TaskBoard";
import { AppContext } from "../utils/AppContext";
import { apiFetch, getMe } from "../net/api";

export function WorkspacePage() {
  const { workspaceId } = useParams();
  const { setCurrentWorkspace } = useContext(AppContext);
  const [workspaceRole, setWorkspaceRole] = React.useState("viewer");
  const [currentUserId, setCurrentUserId] = React.useState(null);

  useEffect(() => {
    if (typeof setCurrentWorkspace === "function") {
      setCurrentWorkspace(workspaceId || null);
    }
  }, [workspaceId, setCurrentWorkspace]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceContext() {
      if (!workspaceId) {
        return;
      }

      try {
        const [workspacePayload, mePayload] = await Promise.all([
          apiFetch(`/api/workspaces/${workspaceId}`),
          getMe(),
        ]);

        if (cancelled) {
          return;
        }

        setWorkspaceRole(workspacePayload?.workspace?.role || "viewer");
        setCurrentUserId(mePayload?.user?.id || null);
      } catch (_error) {
        if (cancelled) {
          return;
        }

        setWorkspaceRole("viewer");
        setCurrentUserId(null);
      }
    }

    loadWorkspaceContext();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

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
        <CanvasView
          workspaceId={workspaceId}
          workspaceRole={workspaceRole}
          userId={currentUserId}
        />
        <TaskBoard workspaceId={workspaceId} />
      </section>
    </main>
  );
}
