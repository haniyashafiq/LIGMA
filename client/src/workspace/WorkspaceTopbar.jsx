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
  handleLogout,
  presenceMembers = [],
  currentUserId,
  canvasController
}) {
  const { visibleMembers, remainingCount } = React.useMemo(() => {
    const MAX_VISIBLE_AVATARS = 5;
    return {
      visibleMembers: presenceMembers.slice(0, MAX_VISIBLE_AVATARS),
      remainingCount: Math.max(0, presenceMembers.length - MAX_VISIBLE_AVATARS)
    };
  }, [presenceMembers]);

  const getInitials = React.useCallback((username, id, isMe) => {
    if (isMe) return "Y";
    const fallback = id ? String(id).slice(-2).toUpperCase() : "?";
    if (!username) return fallback;
    const parts = username.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    const cleanName = username.trim();
    return cleanName ? cleanName.slice(0, 2).toUpperCase() : fallback;
  }, []);

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
        
        <div className="ws-presence-stack">
          {visibleMembers.map((member) => {
            const isMe = String(member.userId) === String(currentUserId);
            return (
              <div 
                key={member.id || member.socketId} 
                className={`ws-presence-avatar${isMe ? " is-me" : ""}`} 
                style={{ 
                  backgroundColor: member.color || "var(--color-primary)",
                  cursor: isMe ? "default" : "pointer"
                }}
                title={isMe ? "You" : (member.username || `User ${member.userId || member.id}`)}
                onClick={() => {
                  if (!isMe && canvasController?.jumpToUser) {
                    canvasController.jumpToUser(member.userId || member.id);
                  }
                }}
              >
                {getInitials(member.username, member.userId || member.id, isMe)}
              </div>
            );
          })}
          {remainingCount > 0 && (
            <div className="ws-presence-avatar more" title={`${remainingCount} more users`}>
              +{remainingCount}
            </div>
          )}
        </div>

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
