import { useEffect } from "react";

// Hook that listens to the tldraw store and emits app-level events.
// For now it uses store.listen() and logs user-originated entries.
export default function useCanvasSync(store, workspaceId) {
  useEffect(() => {
    if (!store) return;

    const onChange = (entry) => {
      try {
        // tldraw entries include .source === 'local' | 'remote'
        if (entry.source === "remote") return;

        // Simple handling: log create/update/delete for later wiring to Socket.IO
        if (entry.type === "shape") {
          // entry.subtype may indicate create/update/delete depending on API
          console.log("[useCanvasSync] local shape entry", entry);
        } else {
          console.log("[useCanvasSync] entry", entry);
        }
        // TODO: emit via Socket.IO client to server for RBAC + event store
      } catch (e) {
        // swallow
      }
    };

    const unlisten = store.listen(onChange);
    return () => {
      try {
        unlisten();
      } catch (e) {}
    };
  }, [store, workspaceId]);
}
import { useEffect } from 'react'
import { createWorkspaceSocket } from '../net/socket'

// Hook that listens to the tldraw store and forwards local changes to the server
// via the existing Socket.IO `canvas:*` events. It also listens for server
// `canvas:delta`/`canvas:sync` messages (currently logged; applying them to
// the tldraw store is a follow-up task).
export default function useCanvasSync(store, workspaceId) {
  useEffect(() => {
    if (!store || !workspaceId) return

    // Token should be provided by your auth flow (stored in AppContext/session)
    const token = sessionStorage.getItem('ligma:token') || null
    if (!token) {
      console.warn('[useCanvasSync] No auth token found in sessionStorage')
    }

    const client = createWorkspaceSocket({ token, workspaceId })

    function handleServerDelta(delta) {
      // Best-effort apply server delta to tldraw editor.
      try {
        const editor = store?.getEditor ? store.getEditor() : null
        if (!editor) {
          console.debug('[useCanvasSync] server delta (no editor)', delta)
          return
        }

        const eventType = delta?.eventType
        const payload = delta?.payload || {}
        const nodeId = delta?.nodeId || payload?.nodeId || payload?.shape?.id

        if (eventType === 'canvas:node:create') {
          const shape = payload.shape || payload
          if (typeof editor.createShapes === 'function') {
            editor.createShapes([shape])
          } else if (typeof store.createShapes === 'function') {
            store.createShapes([shape])
          } else {
            console.debug('[useCanvasSync] createShapes not available', shape)
          }
        } else if (eventType === 'canvas:node:update') {
          const shape = payload.shape || payload
          if (typeof editor.updateShapes === 'function') {
            editor.updateShapes([shape])
          } else if (typeof store.updateShapes === 'function') {
            store.updateShapes([shape])
          } else if (typeof editor.replaceShapes === 'function') {
            editor.replaceShapes([shape])
          } else {
            console.debug('[useCanvasSync] updateShapes not available', shape)
          }
        } else if (eventType === 'canvas:node:delete') {
          if (!nodeId) return
          if (typeof editor.deleteShapes === 'function') {
            editor.deleteShapes([nodeId])
          } else if (typeof store.deleteShapes === 'function') {
            store.deleteShapes([nodeId])
          } else {
            console.debug('[useCanvasSync] deleteShapes not available', nodeId)
          }
        } else if (eventType === 'canvas:draw:stroke') {
          // strokes are shapes in tldraw; try to create
          const stroke = payload.stroke || payload
          if (stroke) {
            if (typeof editor.createShapes === 'function') {
              editor.createShapes([stroke])
            } else {
              console.debug('[useCanvasSync] stroke received but cannot create shape', stroke)
            }
          }
        } else {
          // generic: log
          console.debug('[useCanvasSync] server delta unhandled', delta)
        }
      } catch (e) {
        console.error('[useCanvasSync] failed to apply server delta', e)
      }
    }

    function handleServerSync(payload) {
      try {
        const events = Array.isArray(payload?.events) ? payload.events : []
        events.forEach((ev) => handleServerDelta(ev))
      } catch (e) {
        console.error('[useCanvasSync] failed to apply server sync', e)
      }
    }

    const offDelta = client.on('canvas:delta', handleServerDelta)
    const offSync = client.on('canvas:sync', handleServerSync)

    const onChange = (entry) => {
      try {
        // tldraw entries include .source — skip remote-applied changes
        if (entry.source === 'remote') return

        // Map store entries into the canvas event types the server expects.
        // This mapping is intentionally lightweight; extend with shape->payload
        // serialization as needed.
        if (entry.type === 'shape') {
          const payload = {
            nodeId: entry.shape?.id || entry.id || null,
            shape: entry.shape || entry,
          }

          if (entry.subtype === 'create') {
            client.emit('canvas:node:create', payload)
          } else if (entry.subtype === 'update') {
            client.emit('canvas:node:update', payload)
          } else if (entry.subtype === 'delete') {
            client.emit('canvas:node:delete', payload)
          } else {
            // fallback: send as update
            client.emit('canvas:node:update', payload)
          }
        } else if (entry.type === 'draw') {
          // map freehand strokes to draw events
          client.emit('canvas:draw:stroke', { stroke: entry.stroke || entry })
        } else {
          // generic fallback
          client.emit('canvas:node:update', { entry })
        }
      } catch (e) {
        console.error('[useCanvasSync] failed to emit entry', e)
      }
    }

    const unsubscribe = store.listen(onChange)

    return () => {
      try { unsubscribe() } catch (e) {}
      try { offDelta() } catch (e) {}
      try { offSync() } catch (e) {}
      try { client.disconnect() } catch (e) {}
    }
  }, [store, workspaceId])
}
