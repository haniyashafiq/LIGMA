import React, { useEffect, useMemo, useContext } from "react";
import { io } from "socket.io-client";
import { Tldraw, inlineBase64AssetStore } from "tldraw";
import { useSync } from "@tldraw/sync";
import { AppContext } from "../utils/AppContext";
import "../styles/canvas.css";

import { getAccessToken } from "../net/api";

function createSocketIoTldrawSocket({
  workspaceId,
  token,
  sessionId,
  storeId,
}) {
  const socketBaseUrl =
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_SERVER_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

  const socket = io(socketBaseUrl, {
    auth: (cb) => {
      cb({
        token: getAccessToken() || token,
        workspaceId,
      });
    },
    query: {
      sessionId,
      storeId,
    },
  });

  const messageListeners = new Set();
  const statusListeners = new Set();
  let connectionStatus = socket.connected ? "online" : "offline";

  function notifyStatus(nextStatus, reason) {
    connectionStatus =
      nextStatus === "error" ||
        nextStatus === "online" ||
        nextStatus === "offline"
        ? nextStatus
        : "offline";

    const statusEvent = reason
      ? { status: connectionStatus, reason }
      : { status: connectionStatus };

    statusListeners.forEach((listener) => listener(statusEvent));
  }

  socket.on("tldraw-message", (message) => {
    try {
      const parsed = typeof message === "string" ? JSON.parse(message) : message;
      messageListeners.forEach((listener) => listener(parsed));
    } catch (e) {
      console.error("Failed to parse tldraw-message", e);
    }
  });

  socket.on("task:sync", (data) => {
    window.dispatchEvent(new CustomEvent('ligma:task-sync', { detail: data }));
  });

  socket.on("disconnect", () => {
    notifyStatus("offline");
  });

  socket.on("connect_error", (error) => {
    notifyStatus("error", error?.message || "Connection error");
  });

  socket.on("connect", () => {
    notifyStatus("online");
  });

  return {
    get connectionStatus() {
      return connectionStatus;
    },
    get readyState() {
      return socket.connected ? 1 : 3;
    },
    onReceiveMessage(callback) {
      messageListeners.add(callback);
      return () => {
        messageListeners.delete(callback);
      };
    },
    onStatusChange(callback) {
      statusListeners.add(callback);
      return () => {
        statusListeners.delete(callback);
      };
    },
    send(message) {
      socket.emit("tldraw-message", message);
    },
    sendMessage(message) {
      socket.emit("tldraw-message", message);
    },
    close() {
      socket.disconnect();
    },
    restart() {
      socket.disconnect();
      socket.connect();
    },
  };
}

function createNoopSocket() {
  const messageListeners = new Set();
  const statusListeners = new Set();
  let connectionStatus = "offline";

  return {
    get connectionStatus() {
      return connectionStatus;
    },
    get readyState() {
      return 3;
    },
    onReceiveMessage(callback) {
      // noop
      return () => { };
    },
    onStatusChange(callback) {
      statusListeners.add(callback);
      // immediately notify offline
      try {
        callback({ status: connectionStatus });
      } catch (e) { }
      return () => statusListeners.delete(callback);
    },
    send() {
      // noop
    },
    sendMessage() { },
    close() { },
    restart() { },
  };
}

import { classifyIntent } from "../net/ai.service";
import { apiFetch } from "../net/api";

/**
 * CanvasView component
 * Now fully integrated into the Figma-style shell.
 * It exposes the editor instance back to the parent via onMount.
 */
export default function CanvasView({ workspaceId, onMount, gridMode = true }) {
  const { token, exposeJump, setConnectionStatus, user } = useContext(AppContext);

  const syncState = useSync(
    useMemo(
      () => ({
        connect: ({ sessionId, storeId }) =>
          token
            ? createSocketIoTldrawSocket({
              workspaceId,
              token,
              sessionId,
              storeId,
            })
            : createNoopSocket(),
        assets: inlineBase64AssetStore,
      }),
      [token, workspaceId],
    ),
  );

  useEffect(() => {
    if (!setConnectionStatus) return;
    setConnectionStatus(syncState.connectionStatus || "disconnected");
  }, [setConnectionStatus, syncState.connectionStatus]);

  const handleMount = (editor) => {
    if (onMount) onMount(editor);

    // expose jumpToNode via context for TaskBoard to call
    const jumpToNode = (nodeId) => {
      try {
        const shape = editor.getShape(nodeId);
        if (!shape) return;
        const bounds = editor.getShapePageBounds(shape);
        editor.zoomToBounds(bounds, { animation: { duration: 500 } });
      } catch (e) {
        // ignore
      }
    };
    if (exposeJump) exposeJump(jumpToNode);

    // Listen for task changes from the board
    const handleTaskSync = (e) => {
      const data = e.detail;
      if (data.sourceNodeId) {
        const shape = editor.getShape(data.sourceNodeId);
        if (!shape) return;

        if (data.deleted) {
          editor.deleteShapes([data.sourceNodeId]);
        } else if (data.title) {
          const cleanText = data.title;
          const tag = `[Action Item]`;
          const newText = `${tag}\n${cleanText}`;
          
          const newProps = { ...shape.props };
          if (newProps.richText) {
            newProps.richText = {
              ...newProps.richText,
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: newText }]
                }
              ]
            };
          } else {
            newProps.text = newText;
          }

          editor.updateShapes([{
            id: shape.id,
            props: newProps
          }]);
        }
      }
    };
    window.addEventListener('ligma:task-sync', handleTaskSync);

    // Listen for shape deletions on the canvas to remove linked tasks
    const handleStoreChange = (record) => {
      // log for debugging
      if (record.changes.removed && Object.keys(record.changes.removed).length > 0) {
        console.log('[DEBUG] Store record changed (removed):', record);
        
        Object.keys(record.changes.removed).forEach(id => {
          const shape = record.changes.removed[id];
          if (shape && (shape.type === 'note' || shape.type === 'text' || shape.type === 'geo')) {
            apiFetch(`/api/workspaces/${workspaceId}/tasks/node/${id}`, {
              method: 'DELETE'
            }).then(() => {
              window.dispatchEvent(new CustomEvent('ligma:tasks-updated'));
            }).catch(err => console.error('Task deletion API error:', err));
          }
        });
      }
    };
    const cleanupStoreListen = editor.store.listen(handleStoreChange, { scope: 'all' });

    // AI Intent Classification Logic
    let lastEditingId = null;

    const handleChange = () => {
      const editingId = editor.getEditingShapeId() || null;
      if (editingId !== lastEditingId) {
        if (lastEditingId && !editingId) {
          const shape = editor.getShape(lastEditingId);
          
          if (shape && (shape.type === 'note' || shape.type === 'text' || shape.type === 'geo')) {
            // Helper to extract text from complex richText structure
            const extractText = (props) => {
              if (props.text) return props.text;
              if (props.label) return props.label;
              if (props.richText?.content) {
                try {
                  // Traverse the content to find text nodes
                  let text = "";
                  const traverse = (node) => {
                    if (node.text) text += node.text;
                    if (node.content) node.content.forEach(traverse);
                  };
                  props.richText.content.forEach(traverse);
                  return text;
                } catch (e) { return ""; }
              }
              return "";
            };

            const originalText = extractText(shape.props);
            const cleanText = originalText.replace(/^\[.*?\]\s*/, '').trim();
            
            if (cleanText.length >= 1) {
              classifyIntent(cleanText).then(async (result) => {
                const { intent, status } = result;
                const displayIntent = intent.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                const tag = `[${displayIntent}]`;
                
                if (!originalText.startsWith(tag)) {
                  const newText = `${tag}\n${cleanText}`;
                  const newProps = { ...shape.props };
                  
                  // Update richText structure if it exists
                  if (newProps.richText) {
                    newProps.richText = {
                      ...newProps.richText,
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: newText }]
                        }
                      ]
                    };
                  } else {
                    newProps.text = newText;
                  }

                  editor.updateShape({
                    id: shape.id,
                    type: shape.type,
                    props: newProps
                  });
                }
                
                if (intent === 'action item') {
                  await apiFetch(`/api/workspaces/${workspaceId}/tasks/node/${shape.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                      title: cleanText,
                      status: status || 'todo',
                      source: 'ai',
                      assigneeId: user?.id
                    })
                  });
                  window.dispatchEvent(new CustomEvent('ligma:tasks-updated'));
                } else {
                  // If it was a task but now it's something else, remove it
                  await apiFetch(`/api/workspaces/${workspaceId}/tasks/node/${shape.id}`, {
                    method: 'DELETE'
                  });
                  window.dispatchEvent(new CustomEvent('ligma:tasks-updated'));
                }
              }).catch(err => console.error('AI Error:', err));
            }
          }
        }
        lastEditingId = editingId;
      }
    };

    editor.on('change', handleChange);

    return () => {
      editor.off('change', handleChange);
      window.removeEventListener('ligma:task-sync', handleTaskSync);
      cleanupStoreListen();
    };
  };

  return (
    <div className="canvas-container">
      {syncState.status === "loading" && (
        <div className="ws-loading">
          <div className="ws-loading-spinner" />
          Connecting to workspace...
        </div>
      )}
      {syncState.status === "error" && (
        <div className="error-canvas">Error connecting to workspace</div>
      )}
      {syncState.status === "synced-remote" && (
        <Tldraw
          store={syncState.store}
          onMount={handleMount}
          hideUi={true}
          gridMode={gridMode}
        />
      )}
    </div>
  );
}
