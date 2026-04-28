import React from "react";
import "../styles/workspace.css";

const ROLE_STYLES = {
  lead: "role-lead",
  contributor: "role-contributor",
  viewer: "role-viewer",
};

export default function RoleBadge({ role }) {
  const normalized =
    typeof role === "string" ? role.trim().toLowerCase() : "viewer";
  const cls = ROLE_STYLES[normalized] || ROLE_STYLES.viewer;
  const label =
    normalized === "lead"
      ? "Lead"
      : normalized === "contributor"
        ? "Contributor"
        : "Viewer";

  return (
    <span className={`role-badge ${cls}`} title={`Role: ${label}`}>
      {label}
    </span>
  );
}
