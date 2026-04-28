import React from "react";

const ROLE_LABELS = {
  lead: "Lead",
  contributor: "Contributor",
  viewer: "Viewer",
};

export default function RoleBadge({ role, compact = false }) {
  const normalizedRole =
    typeof role === "string" ? role.trim().toLowerCase() : "viewer";
  const label = ROLE_LABELS[normalizedRole] || "Viewer";

  return (
    <span
      className={`ws-role-badge ${normalizedRole}${compact ? " compact" : ""}`}
      title={`Role: ${label}`}
    >
      {label}
    </span>
  );
}
