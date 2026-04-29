import React from "react";
import { Link } from "react-router-dom";
import { 
  FiArrowLeft, 
  FiBell, 
  FiHelpCircle, 
  FiShare2, 
  FiUsers, 
  FiSettings, 
  FiLogOut 
} from "react-icons/fi";
import RoleBadge from "./RoleBadge";

export function WorkspaceTopbar({ 
  workspaceName, 
  activeTab, 
  setActiveTab, 
  workspaceId, 
  navigate, 
  setShareOpen, 
  setMembersOpen, 
  workspaceRole, 
  connectionDot, 
  connectionStatus, 
  setExecOpen, 
  handleLogout 
}) {
  return (
    <header className="workspace-topbar">
      <div className="workspace-topbar-left">
        <button
          className="ws-topbar-back-btn"
          onClick={() => navigate("/workspaces")}
          title="Go back to projects"
        >
          <FiArrowLeft size={16} />
        </button>

        <Link to="/workspaces" className="workspace-topbar-logo">
          <span className="workspace-topbar-logo-mark">LIGMA</span>
        </Link>

        <div className="ws-name-container">
          <span className="ws-name-label">{workspaceName}</span>
        </div>

        <div className="workspace-topbar-tabs">
          {["Workspace", "Board", "Timeline"].map((tab) => (
            <button
              key={tab}
              className={
                "workspace-tab" +
                (activeTab === tab.toLowerCase() ? " active" : "")
              }
              onClick={() => {
                const newTab = tab.toLowerCase();
                setActiveTab(newTab);
                navigate(`/workspace/${workspaceId}/${newTab}`);
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="workspace-topbar-right">
        <button
          className="ws-topbar-icon-btn"
          aria-label="Notifications"
          title="Notifications"
        >
          <FiBell size={15} />
        </button>
        <button
          className="ws-topbar-icon-btn"
          aria-label="Help"
          title="Help"
        >
          <FiHelpCircle size={15} />
        </button>

        <button className="ws-share-btn" onClick={() => setShareOpen(true)}>
          <FiShare2 size={12} style={{ marginRight: 4 }} />
          Share
        </button>
        <button className="ws-members-btn" onClick={() => setMembersOpen(true)}>
          <FiUsers size={12} style={{ marginRight: 4 }} />
          Members
        </button>
        <RoleBadge role={workspaceRole} />

        <button
          className="ws-mode-badge"
          title="Connection status"
        >
          <span className={`ws-connection-dot ${connectionDot}`} />
          {connectionStatus === "online" ? "Connected" : "Connecting…"}
        </button>

        <button
          className="ws-topbar-settings"
          aria-label="Settings"
          onClick={() => setExecOpen((v) => !v)}
        >
          <FiSettings size={15} />
        </button>

        <button
          className="ws-topbar-icon-btn"
          aria-label="Logout"
          title="Logout"
          onClick={handleLogout}
          style={{ marginLeft: 4 }}
        >
          <FiLogOut size={15} color="var(--color-danger)" />
        </button>
      </div>
    </header>
  );
}
