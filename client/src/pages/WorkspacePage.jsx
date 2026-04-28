import React, { useContext, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import CanvasView from "../components/CanvasView";
import TimeTravel from "../canvas/TimeTravel";
import { TaskBoard } from "../board/TaskBoard";
import { AppContext } from "../utils/AppContext";
import { apiFetch, getMe } from "../net/api";
import MembersSidebar from "../workspace/MembersSidebar";
import RoleBadge from "../workspace/RoleBadge";
import "../styles/workspace.css";

export function WorkspacePage() {
  const { workspaceId } = useParams();
  const { setCurrentWorkspace, timeTravelOpen } = useContext(AppContext);
  const [workspaceRole, setWorkspaceRole] = React.useState("viewer");
  const [currentUserId, setCurrentUserId] = React.useState(null);
  const [workspaceMembers, setWorkspaceMembers] = React.useState([]);

  const reloadWorkspace = useCallback(async () => {
    if (!workspaceId) {
      return;
    }
    try {
      const workspacePayload = await apiFetch(`/api/workspaces/${workspaceId}`);
      setWorkspaceRole(workspacePayload?.workspace?.role || "viewer");
      setWorkspaceMembers(workspacePayload?.members || []);
    } catch (_e) {
      setWorkspaceRole("viewer");
      setWorkspaceMembers([]);
    }
  }, [workspaceId]);

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
        setWorkspaceMembers(workspacePayload?.members || []);
        setCurrentUserId(mePayload?.user?.id || null);
      } catch (_error) {
        if (cancelled) {
          return;
        }

        setWorkspaceRole("viewer");
        setWorkspaceMembers([]);
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
          <div className="workspace-role-pill">
            <span className="muted-text small">Your role</span>
            <RoleBadge role={workspaceRole} />
          </div>
        </div>

        <Link className="secondary-button" to="/workspaces">
          Back to workspaces
        </Link>
      </header>

      <MembersSidebar
        workspaceId={workspaceId}
        workspaceMembers={workspaceMembers}
        currentUserId={currentUserId}
        workspaceRole={workspaceRole}
        onMembersChanged={reloadWorkspace}
      />

      <section className="canvas-stage panel">
        <CanvasView
          workspaceId={workspaceId}
          workspaceRole={workspaceRole}
          userId={currentUserId}
        />
        {timeTravelOpen ? <TimeTravel workspaceId={workspaceId} /> : null}
        <TaskBoard workspaceId={workspaceId} />
      </section>
    </main>
  );
}
