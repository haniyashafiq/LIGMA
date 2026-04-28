import React, { useContext, useState } from "react";
import { AppContext } from "../utils/AppContext";
import { apiFetch } from "../net/api";
import RoleBadge from "./RoleBadge";
import "../styles/workspace.css";

function onlineForUser(presenceList, userId) {
  if (!userId || !Array.isArray(presenceList)) {
    return false;
  }
  return presenceList.some((p) => p?.user?.id === userId);
}

export default function MembersSidebar({
  workspaceId,
  workspaceMembers,
  currentUserId,
  workspaceRole,
  onMembersChanged,
}) {
  const { membersOpen, setMembersOpen, members: presenceList } =
    useContext(AppContext);

  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState("contributor");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!membersOpen) {
    return null;
  }

  const isLead = workspaceRole === "lead";

  async function submitInvite(e) {
    e.preventDefault();
    if (!isLead || !inviteUsername.trim()) {
      return;
    }
    setBusy(true);
    setFeedback("");
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "POST",
        body: JSON.stringify({
          username: inviteUsername.trim(),
          role: inviteRole,
        }),
      });
      setInviteUsername("");
      setFeedback("Invite sent.");
      if (onMembersChanged) onMembersChanged();
    } catch (err) {
      setFeedback(err?.message || "Invite failed.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(targetUserId, nextRole) {
    if (!isLead || !targetUserId || targetUserId === currentUserId) {
      return;
    }
    setBusy(true);
    setFeedback("");
    try {
      await apiFetch(`/api/workspaces/${workspaceId}/roles/${targetUserId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      setFeedback("Role updated.");
      if (onMembersChanged) onMembersChanged();
    } catch (err) {
      setFeedback(err?.message || "Could not change role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="members-sidebar panel">
      <div className="members-sidebar-header">
        <div>
          <strong>Members</strong>
          <p className="muted-text small">
            Online status reflects who is connected to this workspace.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setMembersOpen(false)}
        >
          Close
        </button>
      </div>

      {feedback ? <p className="members-feedback">{feedback}</p> : null}

      {isLead ? (
        <form className="members-invite" onSubmit={submitInvite}>
          <label className="small">
            Username
            <input
              value={inviteUsername}
              onChange={(ev) => setInviteUsername(ev.target.value)}
              placeholder="teammate_login"
              autoComplete="off"
            />
          </label>
          <label className="small">
            Role
            <select
              value={inviteRole}
              onChange={(ev) => setInviteRole(ev.target.value)}
            >
              <option value="viewer">Viewer</option>
              <option value="contributor">Contributor</option>
              <option value="lead">Lead</option>
            </select>
          </label>
          <button
            type="submit"
            className="secondary-button"
            disabled={busy || !inviteUsername.trim()}
          >
            Invite
          </button>
        </form>
      ) : null}

      <ul className="members-sidebar-list">
        {Array.isArray(workspaceMembers) && workspaceMembers.length > 0 ? (
          workspaceMembers.map((m) => {
            const uid = m.userId;
            const online = onlineForUser(presenceList, uid);
            const canEditRole = isLead && uid && uid !== currentUserId;
            return (
              <li key={uid || m.username} className="members-sidebar-row">
                <span
                  className={`presence-dot ${online ? "online" : "offline"}`}
                  title={online ? "Online" : "Offline"}
                />
                <div className="members-sidebar-user">
                  <span className="member-display">
                    {m.displayName || m.username || uid}
                  </span>
                  <span className="muted-text small">{m.username}</span>
                </div>
                <RoleBadge role={m.role} />
                {canEditRole ? (
                  <select
                    className="role-select"
                    value={m.role}
                    disabled={busy}
                    onChange={(ev) => changeRole(uid, ev.target.value)}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="contributor">Contributor</option>
                    <option value="lead">Lead</option>
                  </select>
                ) : null}
              </li>
            );
          })
        ) : (
          <li className="muted-text">No members loaded.</li>
        )}
      </ul>
    </div>
  );
}
