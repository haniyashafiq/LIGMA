import React, { useMemo, useState } from "react";
import { FiCopy, FiLink2, FiUserPlus, FiUsers, FiX } from "react-icons/fi";

const INVITE_ROLES = ["lead", "contributor", "viewer"];

function buildWorkspaceLink() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

export default function ShareWorkspaceModal({
  open,
  onClose,
  onInvite,
  onCreateInviteLink,
  canManageMembers,
  onOpenMembers,
}) {
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState("contributor");
  const [linkRole, setLinkRole] = useState("viewer");
  const [busyInvite, setBusyInvite] = useState(false);
  const [busyLink, setBusyLink] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const workspaceLink = useMemo(() => buildWorkspaceLink(), []);

  async function handleInviteSubmit(event) {
    event.preventDefault();
    if (!canManageMembers || typeof onInvite !== "function") return;

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

  async function handleCopyLink() {
    setCopyMessage("");
    setActionMessage("");
    setErrorMessage("");

    if (!canManageMembers || typeof onCreateInviteLink !== "function") {
      try {
        await navigator.clipboard.writeText(workspaceLink);
        setCopyMessage("Link copied.");
      } catch (_error) {
        setErrorMessage("Copy failed. Please try again.");
      }
      return;
    }

    try {
      setBusyLink(true);
      const payload = await onCreateInviteLink({ role: linkRole });
      await navigator.clipboard.writeText(payload?.inviteUrl || workspaceLink);
      setCopyMessage(`Link copied with ${linkRole} role.`);
    } catch (error) {
      setErrorMessage(error?.message || "Copy failed. Please try again.");
    } finally {
      setBusyLink(false);
    }
  }

  if (!open) return null;

  return (
    <div className="ws-modal-overlay" role="presentation" onClick={onClose}>
      <section
        className="ws-modal ws-share-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Share workspace"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ws-dialog-header">
          <h2>Share Workspace</h2>
          <button
            className="ws-dialog-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Close share modal"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="ws-share-link-block">
          <label htmlFor="workspace-share-link">
            <FiLink2 size={13} /> Share link
          </label>
          {canManageMembers && (
            <>
              <label htmlFor="workspace-link-role">Role for this link</label>
              <select
                id="workspace-link-role"
                value={linkRole}
                onChange={(event) => setLinkRole(event.target.value)}
              >
                {INVITE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="ws-share-link-row">
            <input id="workspace-share-link" type="text" value={workspaceLink} readOnly />
            <button type="button" onClick={handleCopyLink} disabled={busyLink}>
              <FiCopy size={13} />
              {busyLink ? "Creating..." : "Copy Link"}
            </button>
          </div>
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

        <div className="ws-share-footer-actions">
          <button type="button" className="ws-secondary-btn" onClick={onOpenMembers}>
            <FiUsers size={14} />
            View Members
          </button>
        </div>

        {errorMessage && <p className="ws-members-feedback error">{errorMessage}</p>}
        {actionMessage && <p className="ws-members-feedback success">{actionMessage}</p>}
        {copyMessage && <p className="ws-members-feedback success">{copyMessage}</p>}
      </section>
    </div>
  );
}
