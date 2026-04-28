import React, { useMemo, useState } from "react";
import { FiUserPlus, FiX } from "react-icons/fi";
import RoleBadge from "./RoleBadge";

const MANAGEABLE_ROLES = ["contributor", "viewer"];
const INVITE_ROLES = ["lead", "contributor", "viewer"];

function normalizeRole(role) {
  return typeof role === "string" ? role.trim().toLowerCase() : "viewer";
}

function keyForMember(member) {
  return String(member.userId || member.username || member.displayName || "");
}

export default function MembersSidebar({
  open,
  onClose,
  members,
  onlineUserIds,
  onlineUsernames,
  currentUserId,
  currentRole,
  onInvite,
  onChangeRole,
}) {
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState("contributor");
  const [busyInvite, setBusyInvite] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [busyRoleUserId, setBusyRoleUserId] = useState(null);

  const canManageMembers = normalizeRole(currentRole) === "lead";
  const safeMembers = Array.isArray(members) ? members : [];

  const normalizedOnlineUserIds = useMemo(() => {
    return new Set((onlineUserIds || []).map((value) => String(value)));
  }, [onlineUserIds]);

  const normalizedOnlineUsernames = useMemo(() => {
    return new Set(
      (onlineUsernames || [])
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean),
    );
  }, [onlineUsernames]);

  async function handleInviteSubmit(event) {
    event.preventDefault();
    if (!canManageMembers || typeof onInvite !== "function") {
      return;
    }

    setActionMessage("");
    setErrorMessage("");
    setBusyInvite(true);

    try {
      await onInvite({ username: inviteUsername.trim(), role: inviteRole });
      setInviteUsername("");
      setInviteRole("contributor");
      setActionMessage("Invite sent successfully.");
    } catch (error) {
      setErrorMessage(error?.message || "Failed to invite member.");
    } finally {
      setBusyInvite(false);
    }
  }

  async function handleRoleChange(member, nextRole) {
    if (!canManageMembers || typeof onChangeRole !== "function") {
      return;
    }

    const userId = String(member.userId || "");
    if (!userId) return;

    setActionMessage("");
    setErrorMessage("");
    setBusyRoleUserId(userId);

    try {
      await onChangeRole({ userId, role: nextRole });
      setActionMessage("Role updated.");
    } catch (error) {
      setErrorMessage(error?.message || "Failed to update role.");
    } finally {
      setBusyRoleUserId(null);
    }
  }

  if (!open) return null;

  return (
    <aside className="ws-members-sidebar" aria-label="Members sidebar">
      <div className="ws-members-sidebar-header">
        <h2>Workspace Members</h2>
        <button
          className="ws-members-close-btn"
          type="button"
          onClick={onClose}
          aria-label="Close members sidebar"
        >
          <FiX size={16} />
        </button>
      </div>

      <div className="ws-members-list-wrap">
        {safeMembers.length === 0 && (
          <div className="ws-members-empty">No members found for this workspace.</div>
        )}

        {safeMembers.map((member) => {
          const userId = String(member.userId || "");
          const username = String(member.username || "").trim().toLowerCase();
          const isOnline =
            normalizedOnlineUserIds.has(userId) ||
            (username && normalizedOnlineUsernames.has(username));
          const isSelf = String(currentUserId || "") === userId;
          const memberRole = normalizeRole(member.role);
          const roleLocked = !canManageMembers || isSelf || busyRoleUserId === userId;

          return (
            <div key={keyForMember(member)} className="ws-member-row">
              <div
                className="ws-member-avatar"
                style={{ background: member.color || "#6366f1" }}
              >
                {(member.displayName || member.username || "U")[0]?.toUpperCase()}
              </div>
              <div className="ws-member-meta">
                <div className="ws-member-name-line">
                  <span className="ws-member-name">
                    {member.displayName || member.username || "Unknown"}
                  </span>
                  {isSelf && <span className="ws-member-you">You</span>}
                </div>
                <div className="ws-member-subline">@{member.username || "unknown"}</div>
                <div className="ws-member-status-line">
                  <span
                    className={`ws-member-presence-dot ${
                      isOnline ? "online" : "offline"
                    }`}
                  />
                  {isOnline ? "Online" : "Offline"}
                </div>
              </div>
              <div className="ws-member-role-col">
                <RoleBadge role={memberRole} compact />
                {canManageMembers && !isSelf ? (
                  <select
                    className="ws-member-role-select"
                    value={memberRole}
                    disabled={roleLocked}
                    onChange={(event) => handleRoleChange(member, event.target.value)}
                  >
                    {MANAGEABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {canManageMembers && (
        <form className="ws-member-invite-form" onSubmit={handleInviteSubmit}>
          <h3>
            <FiUserPlus size={14} />
            Invite Member
          </h3>
          <label htmlFor="invite-username">Username</label>
          <input
            id="invite-username"
            type="text"
            value={inviteUsername}
            onChange={(event) => setInviteUsername(event.target.value)}
            placeholder="Enter username"
            required
          />

          <label htmlFor="invite-role">Role</label>
          <select
            id="invite-role"
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value)}
          >
            {INVITE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <button type="submit" disabled={busyInvite || !inviteUsername.trim()}>
            {busyInvite ? "Inviting..." : "Send Invite"}
          </button>
        </form>
      )}

      {errorMessage && <p className="ws-members-feedback error">{errorMessage}</p>}
      {actionMessage && <p className="ws-members-feedback success">{actionMessage}</p>}
    </aside>
  );
}
