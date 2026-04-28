import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { apiFetch, getAccessToken, getMe } from '../net/api.js';
import { createYjsProvider } from '../net/yjs-provider.js';
import { createEditorAdapter } from './EditorAdapter.js';
import { createNodeManager } from './NodeManager.js';
import { createSyncBridge } from './SyncBridge.js';

export function CanvasWorkspace() {
  const { id: workspaceId } = useParams();
  const token = getAccessToken();
  const adapter = useMemo(() => createEditorAdapter(), []);
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
  const [lastNodeEvent, setLastNodeEvent] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [lastSyncEvent, setLastSyncEvent] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [memberDirectory, setMemberDirectory] = useState(new Map());
  const [remoteCursors, setRemoteCursors] = useState(new Map());
  const syncBridge = useMemo(
    () =>
      createSyncBridge({
        workspaceId,
        token,
        nodeManager: null,
        onConnectionStateChange: setConnectionState,
        onSyncEvent: setLastSyncEvent,
        onCursorEvent: (eventPayload) => {
          const userId = eventPayload?.userId || eventPayload?.payload?.userId;
          if (!userId) {
            return;
          }

          const worldX = Number(eventPayload?.payload?.x);
          const worldY = Number(eventPayload?.payload?.y);
          if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
            return;
          }

          setRemoteCursors((previous) => {
            const next = new Map(previous);
            next.set(userId, {
              userId,
              x: worldX,
              y: worldY,
              updatedAt: Date.now(),
            });
            return next;
          });
        },
      }),
    [workspaceId, token]
  );
  const nodeManager = useMemo(
    () =>
      createNodeManager({
        workspaceId,
        currentUserId: 'demo-user',
        onNodeEvent: (type, payload) => {
          setLastNodeEvent({ type, payload });
          syncBridge.handleLocalNodeEvent(type, payload);
        },
      }),
    [workspaceId, syncBridge]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceContext() {
      try {
        const [mePayload, workspacePayload] = await Promise.all([
          getMe(),
          apiFetch(`/api/workspaces/${workspaceId}`, { method: 'GET' }),
        ]);

        if (!isMounted) {
          return;
        }

        setCurrentUser(mePayload?.user || null);
        const nextDirectory = new Map();
        const members = Array.isArray(workspacePayload?.members) ? workspacePayload.members : [];
        members.forEach((member) => {
          if (!member?.userId) {
            return;
          }
          nextDirectory.set(member.userId, member);
        });
        setMemberDirectory(nextDirectory);
      } catch (_error) {
        if (isMounted) {
          setLastSyncEvent({
            direction: 'system',
            eventType: 'workspace:context:error',
            payload: { message: 'Failed to load workspace members/user context.' },
          });
        }
      }
    }

    loadWorkspaceContext();

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  useEffect(
    () => {
      syncBridge.bindNodeManager(nodeManager);
    },
    [nodeManager, syncBridge]
  );

  useEffect(
    () => () => {
      syncBridge.disconnect();
      setRemoteCursors(new Map());
      nodeManager.detach();
      adapter.detach();
    },
    [adapter, nodeManager, syncBridge]
  );

  useEffect(() => {
    let yjsProvider = null;
    const socketClient = syncBridge.getSocketClient();

    if (!socketClient?.socket || !currentUser?.id) {
      return undefined;
    }

    yjsProvider = createYjsProvider({
      socketClient,
      awarenessUser: {
        id: currentUser.id,
        username: currentUser.username,
        color: currentUser.color || '#6366f1',
      },
    });
    nodeManager.bindYjsDoc(yjsProvider.doc);

    return () => {
      yjsProvider?.destroy();
    };
  }, [connectionState, currentUser?.id, currentUser?.username, currentUser?.color, nodeManager, syncBridge]);

  function handleMount(editor) {
    adapter.attach(editor);
    nodeManager.attach(editor);
    const connected = syncBridge.connect();
    if (!connected) {
      setLastSyncEvent({
        direction: 'system',
        eventType: 'sync:inactive',
        payload: { reason: 'Socket bridge inactive. Missing token or workspace context.' },
      });
    }
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

  function handlePointerMove(event) {
    if (!currentUser?.id) {
      return;
    }

    const point = adapter.screenToWorld(event.clientX, event.clientY);
    syncBridge.emitCursorMove({
      x: point.x,
      y: point.y,
      userId: currentUser.id,
    });
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
        <div className="canvas-surface" onMouseMove={handlePointerMove}>
          <Tldraw onMount={handleMount} inferDarkMode persistenceKey={`ligma-workspace-${workspaceId}`} />
          {Array.from(remoteCursors.values()).map((cursor) => {
            if (cursor.userId === currentUser?.id) {
              return null;
            }
            const member = memberDirectory.get(cursor.userId);
            const point = adapter.worldToScreen(cursor.x, cursor.y);
            return (
              <div
                key={cursor.userId}
                className="cursor-dot"
                style={{
                  transform: `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`,
                  background: member?.color || '#8b5cf6',
                }}
              >
                <span>{member?.displayName || member?.username || cursor.userId.slice(0, 8)}</span>
              </div>
            );
          })}
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
            <div>
              <dt>Socket Status</dt>
              <dd className={`canvas-connection-state canvas-connection-state--${connectionState}`}>
                {connectionState}
              </dd>
            </div>
            <div>
              <dt>Last Sync Event</dt>
              <dd>{lastSyncEvent?.eventType || 'No sync events yet'}</dd>
            </div>
          </dl>
          {lastNodeEvent?.payload ? (
            <pre className="canvas-event-preview">{JSON.stringify(lastNodeEvent.payload, null, 2)}</pre>
          ) : null}
          {lastSyncEvent ? (
            <pre className="canvas-event-preview">{JSON.stringify(lastSyncEvent, null, 2)}</pre>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
