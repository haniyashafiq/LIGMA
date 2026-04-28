import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { createEditorAdapter } from './EditorAdapter.js';
import { createNodeManager } from './NodeManager.js';

export function CanvasWorkspace() {
  const { id: workspaceId } = useParams();
  const adapter = useMemo(() => createEditorAdapter(), []);
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
  const [lastNodeEvent, setLastNodeEvent] = useState(null);
  const nodeManager = useMemo(
    () =>
      createNodeManager({
        workspaceId,
        currentUserId: 'demo-user',
        onNodeEvent: (type, payload) => {
          setLastNodeEvent({ type, payload });
        },
      }),
    [workspaceId]
  );

  useEffect(
    () => () => {
      nodeManager.detach();
      adapter.detach();
    },
    [adapter, nodeManager]
  );

  function handleMount(editor) {
    adapter.attach(editor);
    nodeManager.attach(editor);
    setCamera(adapter.getViewportSnapshot());
  }

  function handleJumpDemo() {
    adapter.animateTo(240, 160, 1);
    setCamera(adapter.getViewportSnapshot());
  }

  function spawnSticky() {
    const node = nodeManager.createStickyNote();
    if (node) {
      setLastNodeEvent({
        type: 'canvas:node:create',
        payload: nodeManager.serializeNode(node.id),
      });
    }
  }

  function spawnText() {
    const node = nodeManager.createTextBlock();
    if (node) {
      setLastNodeEvent({
        type: 'canvas:node:create',
        payload: nodeManager.serializeNode(node.id),
      });
    }
  }

  function spawnShape(shapeType) {
    const node = nodeManager.createShape(shapeType);
    if (node) {
      setLastNodeEvent({
        type: 'canvas:node:create',
        payload: nodeManager.serializeNode(node.id),
      });
    }
  }

  return (
    <main className="canvas-page">
      <div className="canvas-toolbar">
        <div>
          <p className="canvas-chip mono">Workspace</p>
          <strong className="canvas-toolbar-title">{workspaceId}</strong>
        </div>
        <div className="canvas-toolbar-actions">
          <button type="button" onClick={spawnSticky}>
            Add Sticky
          </button>
          <button type="button" onClick={spawnText}>
            Add Text
          </button>
          <button type="button" onClick={() => spawnShape('rectangle')}>
            Add Rectangle
          </button>
          <button type="button" onClick={() => spawnShape('ellipse')}>
            Add Ellipse
          </button>
          <button type="button" onClick={() => spawnShape('diamond')}>
            Add Diamond
          </button>
          <button type="button" onClick={handleJumpDemo}>
            Jump Demo Camera
          </button>
          <Link to="/workspaces" className="canvas-link-button">
            Back to Workspaces
          </Link>
        </div>
      </div>

      <section className="canvas-shell">
        <div className="canvas-surface">
          <Tldraw onMount={handleMount} inferDarkMode persistenceKey={`ligma-workspace-${workspaceId}`} />
        </div>

        <aside className="canvas-overlay-card">
          <p className="canvas-chip mono">Phase 5.1</p>
          <h1 className="canvas-overlay-title">tldraw Workspace Scaffold</h1>
          <p className="canvas-overlay-copy">
            The editor surface is mounted and ready for the Phase 5 sync, node, drawing, and presence layers.
          </p>
          <dl className="canvas-meta">
            <div>
              <dt>Workspace</dt>
              <dd>{workspaceId}</dd>
            </div>
            <div>
              <dt>Camera</dt>
              <dd>
                x:{Math.round(camera.x)} y:{Math.round(camera.y)} z:{camera.z.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Last Node Event</dt>
              <dd>{lastNodeEvent?.type || 'No local node events yet'}</dd>
            </div>
          </dl>
          {lastNodeEvent?.payload ? (
            <pre className="canvas-event-preview">{JSON.stringify(lastNodeEvent.payload, null, 2)}</pre>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
