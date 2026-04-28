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
      socket.emit("tldraw-message", JSON.stringify(message));
    },
    sendMessage(message) {
      socket.emit("tldraw-message", JSON.stringify(message));
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
      return () => {};
    },
    onStatusChange(callback) {
      statusListeners.add(callback);
      // immediately notify offline
      try {
        callback({ status: connectionStatus });
      } catch (e) {}
      return () => statusListeners.delete(callback);
    },
    send() {
      // noop
    },
    sendMessage() {},
    close() {},
    restart() {},
  };
}

/**
 * CanvasView component
 * Now fully integrated into the Figma-style shell.
 * It exposes the editor instance back to the parent via onMount.
 */
export default function CanvasView({ workspaceId, onMount }) {
  const { token, exposeJump, setConnectionStatus } = useContext(AppContext);

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
        />
      )}
    </div>
  );
}
