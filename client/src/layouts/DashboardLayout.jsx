import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiInbox,
  FiCheckCircle,
  FiFolder,
  FiUsers,
  FiList,
  FiArchive,
  FiHexagon,
  FiHelpCircle,
  FiSettings,
  FiBell,
  FiSearch,
  FiLogOut,
} from "react-icons/fi";
import { clearAccessToken, logout } from "../net/api";
import "../styles/dashboard.css";

const NAV_ITEMS = [
  { to: "/projects",   Icon: FiFolder,      label: "Projects" },
  { to: "/workspaces", Icon: FiHexagon,     label: "Canvases" },
  { to: "/tasks",      Icon: FiList,        label: "Task Board" },
];

const FOOTER_ITEMS = [
  { to: "/settings", Icon: FiSettings,   label: "Settings" },
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
      <aside className="sidebar glass-panel">
        <Link to="/workspaces" className="sidebar-logo">
          <div className="sidebar-logo-mark">LG</div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">LIGMA</span>
            <span className="sidebar-logo-tagline">collaborative</span>
          </div>
        </Link>

        <div className="sidebar-search">
          <FiSearch className="sidebar-search-icon" size={13} />
          <input
            type="search"
            placeholder="Search canvases..."
            aria-label="Search canvases"
          />
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={
                "sidebar-nav-link" +
                (location.pathname.startsWith(to) ? " active" : "")
              }
            >
              <Icon className="sidebar-nav-icon" size={14} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          {FOOTER_ITEMS.map(({ to, Icon, label }) => (
            <Link key={to} to={to} className="sidebar-nav-link">
              <Icon className="sidebar-nav-icon" size={14} />
              {label}
            </Link>
          ))}
          <button 
            className="sidebar-nav-link logout-btn" 
            onClick={handleLogout}
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <FiLogOut className="sidebar-nav-icon" size={14} />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────── */}
      <div className="dashboard-content">
        {/* Topbar */}
        <header className="dashboard-topbar">
          <button className="topbar-icon-btn" aria-label="Notifications" title="Notifications">
            <FiBell size={16} />
          </button>
          <button className="topbar-icon-btn" aria-label="Help" title="Help">
            <FiHelpCircle size={16} />
          </button>
          <button
            className="btn-ghost"
            onClick={() => navigate("/settings")}
            style={{ fontSize: "var(--text-xs)" }}
          >
            <FiSettings size={14} />
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
