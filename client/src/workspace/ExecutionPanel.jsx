import React from "react";
import { FiActivity, FiFilter, FiMoreHorizontal } from "react-icons/fi";

export function ExecutionPanel({ 
  events, 
  activityFilter, 
  setActivityFilter, 
  showActivityFilter, 
  setShowActivityFilter, 
  currentUser, 
  getEventAction, 
  getUsername 
}) {
  return (
    <aside className="ws-exec-panel">
      <div className="ws-exec-scroll">
        {/* Activity Log Section (Recent) */}
        <div className="ws-section-toggle" style={{ position: 'relative' }}>
          <h3>
            <FiActivity size={12} />
            Recent Activity
          </h3>
          <button
            className="ws-section-add-btn"
            aria-label="Filter events"
            title="Filter events"
            onClick={() => setShowActivityFilter(!showActivityFilter)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              width: 'auto', height: 'auto',
              background: activityFilter !== 'all' ? 'rgba(13, 153, 255, 0.1)' : 'transparent',
              padding: activityFilter !== 'all' ? '4px 8px' : '4px',
              borderRadius: '4px'
            }}
          >
            {activityFilter !== 'all' && (
              <span style={{ fontSize: '10px', color: 'var(--color-primary)', textTransform: 'capitalize', fontWeight: 600 }}>{activityFilter}</span>
            )}
            {activityFilter !== 'all' ? <FiFilter size={12} color="var(--color-primary)" /> : <FiMoreHorizontal size={12} />}
          </button>
          {showActivityFilter && (
            <div className="ws-dropdown-menu">
              {['all', 'mine', 'others'].map(filter => (
                <button
                  key={filter}
                  className={`ws-dropdown-item ${activityFilter === filter ? 'active' : ''}`}
                  onClick={() => { setActivityFilter(filter); setShowActivityFilter(false); }}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
        </div>

        <ul className="ws-activity-list">
          {events.filter(e => {
            if (activityFilter === 'all') return true;
            if (activityFilter === 'mine') return e.userId === currentUser?.id;
            if (activityFilter === 'others') return e.userId !== currentUser?.id;
            return true;
          }).slice(0, 3).map((event) => {
            const action = getEventAction(event);
            return (
              <li key={event.id} className="ws-activity-item">
                <div
                  className="ws-activity-avatar"
                  style={{ background: "#A259FF" }}
                >
                  {getUsername(event.userId).charAt(0).toUpperCase()}
                </div>
                <div className="ws-activity-body">
                  <p>
                    <strong>{getUsername(event.userId)}</strong> {action}
                  </p>
                  <div className="ws-activity-time">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </li>
            );
          })}
          {events.length === 0 && (
            <li className="ws-activity-item">
              <div className="ws-activity-body">
                <p style={{ color: 'var(--color-text-subtle)', fontSize: '12px' }}>No recent activity.</p>
              </div>
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}
