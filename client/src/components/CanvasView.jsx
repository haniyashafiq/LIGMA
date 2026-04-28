import React, {
  useEffect,
  useMemo,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";
import { io } from "socket.io-client";
import { Tldraw, inlineBase64AssetStore } from "tldraw";
import { useSync } from "@tldraw/sync";
import { AppContext } from "../utils/AppContext";
import "../styles/canvas.css";

import { getAccessToken, refreshAccessToken } from "../net/api";

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
  const presenceMembers = new Map();
  let connectionStatus = socket.connected ? "online" : "offline";
  let isRefreshingToken = false;

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

  function emitPresence() {
    window.dispatchEvent(
      new CustomEvent("ligma:presence", {
        detail: {
          members: Array.from(presenceMembers.values()),
        },
      }),
    );
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
    socket.off("workspace:rbac_denied", onWorkspaceRbacDenied);
    notifyStatus("offline");
    presenceMembers.clear();
    emitPresence();
  });

  socket.on("connect_error", (error) => {
    const message = error?.message || "Connection error";
    const isAuthError =
      message.includes("Invalid or expired access token") ||
      message.includes("Authentication required");

    if (isAuthError && !isRefreshingToken) {
      isRefreshingToken = true;

      refreshAccessToken()
        .then(() => {
          socket.connect();
        })
        .catch(() => {
          // Let UI show the real reason so user can re-authenticate.
          notifyStatus("error", message);
        })
        .finally(() => {
          isRefreshingToken = false;
        });

      return;
    }

    notifyStatus("error", message);
  });

  socket.on("connect", () => {
    notifyStatus("online");
  });

  function onWorkspaceRbacDenied(payload) {
    const message =
      payload && typeof payload === "object"
        ? payload.message
        : undefined;
    if (typeof message !== "string" || !message.trim()) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("ligma:rbac-toast", {
        detail: { message: message.trim() },
      }),
    );
  }

  socket.on("workspace:rbac_denied", onWorkspaceRbacDenied);

  socket.on("server:ready", (payload) => {
    const user = payload?.user;
    if (!user) return;
    presenceMembers.set(String(user.userId), user);
    emitPresence();
  });

  socket.on("presence:join", (payload) => {
    const user = payload?.user;
    if (!user) return;
    presenceMembers.set(String(user.userId), user);
    emitPresence();
  });

  socket.on("presence:leave", (payload) => {
    const user = payload?.user;
    if (!user) return;
    presenceMembers.delete(String(user.userId));
    emitPresence();
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
export default function CanvasView({
  workspaceId,
  onMount,
  gridMode = true,
  readOnly = false,
  currentUserId = null,
  currentUserRole = "viewer",
}) {
  const { token, exposeJump, setConnectionStatus } = useContext(AppContext);
  const canvasShellRef = useRef(null);
  const lastPointerRef = useRef(null);

  const [rbacToast, setRbacToast] = useState(null);

  const capturePointerForToast = useCallback((event) => {
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const TOAST_ANIM_MS = 3400;

  useEffect(() => {
    function handleRbacToastEvent(event) {
      const message = event?.detail?.message;
      if (typeof message !== "string" || !message.trim()) return;

      let anchorClientX = window.innerWidth / 2;
      let anchorClientY = window.innerHeight * 0.42;
      const shell = canvasShellRef.current;
      const ptr = lastPointerRef.current;

      if (shell && typeof ptr?.x === "number" && typeof ptr?.y === "number") {
        anchorClientX = ptr.x;
        anchorClientY = ptr.y;
      } else if (shell) {
        const rect = shell.getBoundingClientRect();
        anchorClientX = rect.left + rect.width / 2;
        anchorClientY = rect.top + rect.height / 2;
      }

      setRbacToast({
        message: message.trim(),
        anchorClientX,
        anchorClientY,
        key: Date.now(),
      });
    }

    window.addEventListener("ligma:rbac-toast", handleRbacToastEvent);
    return () =>
      window.removeEventListener("ligma:rbac-toast", handleRbacToastEvent);
  }, []);

  useEffect(() => {
    if (!rbacToast) return undefined;
    const id = window.setTimeout(() => setRbacToast(null), TOAST_ANIM_MS);
    return () => window.clearTimeout(id);
  }, [rbacToast]);

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

    // Apply Figma Dark preferences
    editor.user.updateUserPreferences({ colorScheme: 'dark' });
    
    // Ensure grid is visible (dotted grid pattern)
    editor.updateInstanceState({ isGridMode: true });

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

    // UI-side guard for contributors: prevent deleting shapes they don't own.
    // Server-side RBAC still remains the source of truth.
    const handleKeyDown = (event) => {
      const key = String(event.key || "").toLowerCase();
      if (
        currentUserRole !== "contributor" ||
        (key !== "delete" && key !== "backspace")
      ) {
        return;
      }

      try {
        const selectedShapeIds = editor.getSelectedShapeIds();
        if (!selectedShapeIds || selectedShapeIds.length === 0) return;

        const hasForeignShape = selectedShapeIds.some((shapeId) => {
          const shape = editor.getShape(shapeId);
          const ownerId =
            shape?.meta?.ownerId ??
            shape?.meta?.createdBy ??
            shape?.meta?.userId ??
            shape?.meta?.authorId ??
            shape?.createdById ??
            null;

          // If ownership is not known on the client, stay conservative and block
          // contributor delete. Server-side RBAC remains authoritative.
          if (!ownerId) return true;
          return String(ownerId) !== String(currentUserId);
        });

        if (hasForeignShape) {
          event.preventDefault();
          event.stopPropagation();
        }
      } catch (_error) {
        // ignore keyguard failure
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    editor.disposables?.add?.(() =>
      window.removeEventListener("keydown", handleKeyDown, true),
    );
  };

  return (
    <div
      ref={canvasShellRef}
      className="canvas-container"
      onPointerMove={capturePointerForToast}
      onPointerDown={capturePointerForToast}
    >
      {rbacToast ? (
        <div
          key={rbacToast.key}
          className="canvas-rbac-toast"
          role="status"
          aria-live="polite"
          style={{
            left: rbacToast.anchorClientX,
            top: rbacToast.anchorClientY,
          }}
        >
          {rbacToast.message}
        </div>
      ) : null}
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
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
