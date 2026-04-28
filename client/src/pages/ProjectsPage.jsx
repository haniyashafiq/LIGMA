import React from "react";
import { 
  FiFolder, 
  FiPlus, 
  FiMoreHorizontal, 
  FiSearch, 
  FiZap, 
  FiDatabase, 
  FiTerminal, 
  FiSettings,
  FiCommand,
  FiActivity,
  FiAlertCircle
} from "react-icons/fi";
import "../styles/projects.css";

import { DashboardLayout } from "../layouts/DashboardLayout";

const PROJECTS = [
  {
    id: 1,
    title: "Vector Search Engine",
    description: "Implementing high-dimensional indexing for real-time document search using FAISS and HNSW.",
    progress: 74,
    status: "ON TRACK",
    statusClass: "status-on-track",
    Icon: FiSearch,
    updated: "2h ago",
    members: ["JD", "AS"]
  },
  {
    id: 2,
    title: "Auth Service v2",
    description: "Migration to OIDC and WebAuthn with biometric passkeys for all internal services.",
    progress: 32,
    status: "AT RISK",
    statusClass: "status-at-risk",
    Icon: FiSettings,
    updated: "10m ago",
    members: ["MK"]
  },
  {
    id: 3,
    title: "CLI Tool Refactor",
    description: "Porting our internal developer CLI from Python to Rust for improved performance and safety.",
    progress: 92,
    status: "ON TRACK",
    statusClass: "status-on-track",
    Icon: FiTerminal,
    updated: "5h ago",
    members: ["JD", "MK", "SL"]
  },
  {
    id: 4,
    title: "Real-time Analytics Pipeline",
    description: "Scaling the Kafka streams to handle 1M+ events per second with exactly-once semantics.",
    progress: 45,
    status: "AT RISK",
    statusClass: "status-at-risk",
    Icon: FiActivity,
    updated: "Yesterday",
    members: ["AS", "JD"]
  }
];

const RECENT_CHANGES = [
  {
    id: 1,
    icon: FiCommand,
    title: "Fixed memory leak in rust-analyzer",
    meta: "CLI Tool Refactor • 2 commits",
    user: "alex_k committed"
  },
  {
    id: 2,
    icon: FiZap,
    title: "Deployment Stage: Staging-West-1 Successful",
    meta: "Auth Service v2 • Manual Trigger",
    user: "system_bot updated"
  },
  {
    id: 3,
    icon: FiAlertCircle,
    title: "Health status changed to 'At Risk'",
    meta: "Real-time Analytics Pipeline • Bottleneck detected",
    user: "alert_manager"
  }
];

export default function ProjectsPage({ user }) {
  return (
    <DashboardLayout user={user}>
      <header className="page-header">
        <div className="page-title">
          <h1>Projects</h1>
          <p>Manage and track your active engineering initiatives.</p>
        </div>
        
        <div className="page-actions">
          <div className="avatar-group">
            <div className="avatar-stack" style={{ background: '#FF5733' }}>MK</div>
            <div className="avatar-stack" style={{ background: '#33FF57' }}>JD</div>
            <div className="avatar-stack" style={{ background: '#3357FF' }}>AS</div>
            <div className="avatar-stack">+12</div>
          </div>
          <button className="btn-primary creative-glow">
            <FiPlus size={15} />
            New Project
          </button>
        </div>
      </header>

        {/* Main Grid */}
        <div className="projects-main-grid">
          {/* Project Cards */}
          <div className="projects-cards-container">
            {PROJECTS.map((project) => (
              <div key={project.id} className="project-card">
                <div className="project-card-header">
                  <div className="project-icon-box">
                    <project.Icon size={20} />
                  </div>
                  <div className={`project-status-tag ${project.statusClass}`}>
                    <span className="status-dot" />
                    {project.status}
                  </div>
                </div>
                
                <h2>{project.title}</h2>
                <p>{project.description}</p>
                
                <div className="project-progress-area">
                  <div className="progress-label-row">
                    <span>Progress</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
                
                <div className="project-card-footer">
                  <div className="avatar-group">
                    {project.members.map((m, i) => (
                      <div key={i} className="avatar-stack">{m}</div>
                    ))}
                  </div>
                  <span className="project-updated">Updated {project.updated}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Featured Side Card */}
          <aside className="featured-project-card">
            <div className="featured-header">
              <div className="featured-icon">
                <FiZap size={24} />
              </div>
              <span className="priority-label">Priority 0</span>
            </div>

            <div className="featured-content">
              <h2>LIGMA Cloud Architecture</h2>
              <p>
                The foundational rewrite of our multi-region kubernetes orchestration layer 
                to support auto-scaling across three continents with &lt; 50ms latency.
              </p>
            </div>

            <div className="featured-stats">
              <div className="stat-item">
                <div className="stat-label">Nodes</div>
                <div className="stat-value">12,402</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Health</div>
                <div className="stat-value healthy">99.9%</div>
              </div>
            </div>

            <div className="readiness-area">
              <div className="progress-label-row">
                <span>System Readiness</span>
                <span>89%</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: '89%' }} />
              </div>
            </div>

            <button className="btn-secondary btn-full">
              View Deployment Logs
            </button>
          </aside>
        </div>

        {/* Recent Changes */}
        <section className="recent-changes-section">
          <h2>Recent Changes</h2>
          <div className="changes-list">
            {RECENT_CHANGES.map((change) => (
              <div key={change.id} className="change-item">
                <div className="change-icon-wrap">
                  <change.icon size={14} />
                </div>
                <div className="change-content">
                  <div className="change-title">{change.title}</div>
                  <div className="change-meta">{change.meta}</div>
                </div>
                <div className="change-user">{change.user}</div>
              </div>
            ))}
          </div>
        </section>
    </DashboardLayout>
  );
}
