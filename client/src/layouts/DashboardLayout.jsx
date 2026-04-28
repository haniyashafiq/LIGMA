import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearAccessToken, logout } from "../net/api";
import "../styles/dashboard.css";

const NAV_ITEMS = [
  { to: "/inbox",      icon: "📥", label: "Inbox" },
  { to: "/my-tasks",   icon: "✔︎",  label: "My Tasks" },
  { to: "/projects",   icon: "📁", label: "Projects" },
  { to: "/team",       icon: "👥", label: "Team" },
  { to: "/backlog",    icon: "🗂",  label: "Backlog" },
  { to: "/archive",    icon: "📦", label: "Archive" },
  { to: "/workspaces", icon: "⬡",  label: "Canvases" },
];

const FOOTER_ITEMS = [
  { to: "/support",  icon: "❓", label: "Support" },
  { to: "/settings", icon: "⚙️", label: "Settings" },
];

export function DashboardLayout({ user, children }) {
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout().catch(() => {});
    clearAccessToken();
    navigate("/login", { replace: true });
  }

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="dashboard">
      {/* ── Sidebar ────────────────────────── */}
      <aside className="sidebar">
        <Link to="/workspaces" className="sidebar-logo">
          <div className="sidebar-logo-mark">LG</div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">LIGMA</span>
            <span className="sidebar-logo-tagline">collaborative</span>
          </div>
        </Link>

        <div className="sidebar-search">
          <span className="sidebar-search-icon">🔍</span>
          <input
            type="search"
            placeholder="Search canvases..."
            aria-label="Search canvases"
          />
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <Link
              key={to}
              to={to}
              className={
                "sidebar-nav-link" +
                (location.pathname.startsWith(to) ? " active" : "")
              }
            >
              <span className="sidebar-nav-icon">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          {FOOTER_ITEMS.map(({ to, icon, label }) => (
            <Link
              key={to}
              to={to}
              className="sidebar-nav-link"
            >
              <span className="sidebar-nav-icon">{icon}</span>
              {label}
            </Link>
          ))}
        </div>
      </aside>

      {/* ── Main ───────────────────────────── */}
      <div className="dashboard-content">
        {/* Topbar */}
        <header className="dashboard-topbar">
          <button
            className="topbar-icon-btn"
            aria-label="Notifications"
            title="Notifications"
          >
            🔔
          </button>
          <button
            className="topbar-icon-btn"
            aria-label="Help"
            title="Help"
          >
            ❓
          </button>
          <button
            className="btn-ghost"
            onClick={handleLogout}
            style={{ fontSize: "var(--text-xs)" }}
          >
            Settings
          </button>
          <button
            className="topbar-avatar"
            onClick={handleLogout}
            title={`Logout (${user?.username || ""})`}
            aria-label="User menu"
          >
            {initials}
          </button>
        </header>

        {/* Page content slot */}
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
