import React, { useContext } from "react";
import "../styles/canvas.css";
import { AppContext } from "../utils/AppContext";

export default function MembersPanel() {
  const { membersOpen, members, setMembersOpen } = useContext(AppContext);

  if (!membersOpen) return null;

  return (
    <div className="members-panel">
      <div className="members-panel-header">
        <strong>Members</strong>
        <button onClick={() => setMembersOpen(false)}>Close</button>
      </div>
      <ul className="members-list">
        {members && members.length > 0 ? (
          members.map((m) => (
            <li key={String(m.clientId)} className="member-item">
              <span className="member-name">
                {(m.user && m.user.name) || "Anonymous"}
              </span>
              <span className="member-id">{String(m.clientId)}</span>
            </li>
          ))
        ) : (
          <li className="member-item">No members</li>
        )}
      </ul>
    </div>
  );
}
