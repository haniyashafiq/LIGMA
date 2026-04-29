import React from "react";

export function TimelineView({ 
  events, 
  getEventAction, 
  getUsername 
}) {
  return (
    <div className="ws-full-timeline" style={{ flex: 1, padding: 'var(--space-8)', overflowY: 'auto', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Workspace Timeline</h2>
        <p style={{ color: 'var(--color-text-subtle)', marginBottom: '32px' }}>A complete, append-only history of all events in this workspace.</p>
        
        <div className="ws-timeline-track" style={{ position: 'relative', borderLeft: '2px solid var(--color-border)', marginLeft: '14px', paddingLeft: '32px' }}>
          {events.map((event) => {
            const action = getEventAction(event);

            return (
              <div key={event.id} className="ws-timeline-item" style={{ position: 'relative', marginBottom: '32px' }}>
                <div style={{ position: 'absolute', left: '-39px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid var(--color-bg)' }} />
                <div style={{ fontSize: '12px', color: 'var(--color-text-subtle)', marginBottom: '4px' }}>
                  Seq: {event.sequenceNum} • {new Date(event.createdAt).toLocaleString()}
                </div>
                <div style={{ fontSize: '15px', color: 'var(--color-text)' }}>
                  <strong>{getUsername(event.userId)}</strong> {action}
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <div style={{ color: 'var(--color-text-subtle)' }}>No events recorded.</div>
          )}
        </div>
      </div>
    </div>
  );
}
