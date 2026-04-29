import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { AppContext } from "../utils/AppContext";
import { getAccessToken, refreshAccessToken } from "../net/api";
import "../styles/canvas.css";

function getSocketBaseUrl() {
  return (
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_SERVER_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin)
  );
}

function decodeYjsUpdate(update) {
  if (!update) return null;
  if (update instanceof Uint8Array) return update;
  if (update instanceof ArrayBuffer) return new Uint8Array(update);
  if (Array.isArray(update)) return Uint8Array.from(update);
  if (update.type === "Buffer" && Array.isArray(update.data)) return Uint8Array.from(update.data);
  if (typeof update === "object") return Uint8Array.from(Object.values(update));
  return null;
}

function createCanvasSocket({ workspaceId, token }) {
  const socket = io(getSocketBaseUrl(), {
    auth: (cb) => cb({ token: getAccessToken() || token, workspaceId }),
    reconnection: true,
    reconnectionAttempts: 30,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  const presenceMembers = new Map();
  let isRefreshingToken = false;

  function emitPresence() {
    window.dispatchEvent(
      new CustomEvent("ligma:presence", {
        detail: { members: Array.from(presenceMembers.values()) },
      }),
    );
  }

  function onWorkspaceRbacDenied(payload) {
    const message = payload && typeof payload === "object" ? payload.message : undefined;
    if (!message || typeof message !== "string") return;
    window.dispatchEvent(new CustomEvent("ligma:rbac-toast", { detail: { message } }));
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
  socket.on("disconnect", () => {
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
        .then(() => socket.connect())
        .catch(() => {
          window.dispatchEvent(new CustomEvent("ligma:rbac-toast", { detail: { message } }));
        })
        .finally(() => {
          isRefreshingToken = false;
        });
    }
  });

  return socket;
}

function nextNodeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `node:${crypto.randomUUID()}`;
  }
  return `node:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

const CURSOR_EMIT_MS = 32;
const CURSOR_STALE_MS = 5000;
const CONNECTION_MESSAGES = {
  waking: "Waking up server...",
  reconnecting: "Reconnecting to workspace...",
  error: "Connection interrupted. Retrying...",
  offline: "Workspace offline. Retrying...",
  disconnected: "Connecting to workspace...",
};

// Remote pointer: tip at (0,0) in local coords (classic triangular arrow, down-right).
const REMOTE_CURSOR_ARROW = [0, 0, 0, 20, 5, 15, 9, 24, 12, 22, 8, 13, 15, 13];

function makeNode(type, pointer, currentUser, zIndex) {
  const node = {
    id: nextNodeId(),
    type,
    x: pointer.x,
    y: pointer.y,
    width: type === "text" ? 220 : 180,
    height: type === "text" ? 48 : 100,
    rotation: 0,
    zIndex,
    text: "",
    points: [],
    style: {
      fill: type === "note" ? "#facc15" : "rgba(99, 102, 241, 0.18)",
      stroke: type === "note" ? "#eab308" : "#818cf8",
      strokeWidth: 2,
      fontSize: 18,
    },
    metadata: {
      authorId: currentUser?.id || null,
      authorName: currentUser?.name || currentUser?.username || "Unknown",
    },
  };

  if (type === "text") {
    node.text = "";
    node.style.fill = "transparent";
    node.style.stroke = "transparent";
  }

  if (type === "arrow") {
    node.width = 160;
    node.height = 0;
    node.points = [0, 0, 160, 0];
    node.style.stroke = "#e2e8f0";
  }

  if (type === "draw") {
    node.width = 0;
    node.height = 0;
    node.points = [pointer.x, pointer.y];
    node.style.stroke = "#e2e8f0";
  }

  return node;
}

export default function CanvasView({
  workspaceId,
  onMount,
  activeTool = "select",
  gridMode = true,
  readOnly = false,
  currentUserId = null,
  currentUserRole = "viewer",
  collabUser = null,
}) {
  const { token, exposeJump, setConnectionStatus } = useContext(AppContext);
  const canvasShellRef = useRef(null);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const socketRef = useRef(null);
  const docRef = useRef(null);
  const nodesMapRef = useRef(null);
  const nodesRef = useRef([]);
  const selectedIdRef = useRef(null);
  const activeToolRef = useRef(activeTool);
  const isDrawingRef = useRef(false);
  const drawingNodeRef = useRef(null);
  const lastPointerRef = useRef(null);
  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });
  const lastCursorEmitRef = useRef(0);
  const localSocketIdRef = useRef(null);
  const lastPlacedTextRef = useRef(null);
  const textAreaRef = useRef(null);
  const skipNextTextBlurCommitRef = useRef(false);
  const textEditorRef = useRef(null);
  const reconnectAttemptRef = useRef(0);

  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [rbacToast, setRbacToast] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 700 });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [remoteCursors, setRemoteCursors] = useState({});
  const [textEditor, setTextEditor] = useState(null);
  const [textEditLayout, setTextEditLayout] = useState(null);

  useEffect(() => {
    textEditorRef.current = textEditor;
  }, [textEditor]);

  const capturePointerForToast = useCallback((event) => {
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    function handleRbacToastEvent(event) {
      const message = event?.detail?.message;
      if (typeof message !== "string" || !message.trim()) return;

      const shell = canvasShellRef.current;
      const ptr = lastPointerRef.current;
      const rect = shell?.getBoundingClientRect();
      setRbacToast({
        message: message.trim(),
        anchorClientX: ptr?.x || (rect ? rect.left + rect.width / 2 : window.innerWidth / 2),
        anchorClientY: ptr?.y || (rect ? rect.top + rect.height / 2 : window.innerHeight * 0.42),
        key: Date.now(),
      });
    }

    window.addEventListener("ligma:rbac-toast", handleRbacToastEvent);
    return () => window.removeEventListener("ligma:rbac-toast", handleRbacToastEvent);
  }, []);

  useEffect(() => {
    if (!rbacToast) return undefined;
    const id = window.setTimeout(() => setRbacToast(null), 3400);
    return () => window.clearTimeout(id);
  }, [rbacToast]);

  const updateNodesFromDoc = useCallback(() => {
    const map = nodesMapRef.current;
    if (!map) return;
    setNodes(Array.from(map.values()).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)));
  }, []);

  const emitOp = useCallback(
    (op) => {
      if (readOnly || !socketRef.current?.connected) return;
      socketRef.current.emit("canvas:op", {
        ...op,
        opId:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}:${Math.random()}`,
      });
    },
    [readOnly],
  );

  const getStagePointer = useCallback(() => {
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!stage || !pos) return null;
    const vp = viewportRef.current;
    return {
      x: (pos.x - vp.x) / vp.scale,
      y: (pos.y - vp.y) / vp.scale,
    };
  }, []);

  const resolveTextNode = useCallback((nodeId) => {
    return (
      nodesMapRef.current?.get(nodeId) ||
      (lastPlacedTextRef.current?.id === nodeId ? lastPlacedTextRef.current : null) ||
      nodesRef.current.find((n) => n.id === nodeId) ||
      null
    );
  }, []);

  const computeTextEditLayout = useCallback((nodeId) => {
    const node = resolveTextNode(nodeId);
    const shell = canvasShellRef.current;
    const stage = stageRef.current;
    if (!node || !shell || !stage) return null;
    const vp = viewportRef.current;
    const notePad = 12;
    const isNote = node.type === "note";
    const innerX = isNote ? node.x + notePad : node.x;
    const innerY = isNote ? node.y + notePad : node.y;
    const innerW = isNote ? Math.max(20, (node.width || 180) - notePad * 2) : node.width || 220;
    const innerH = isNote ? Math.max(20, (node.height || 100) - notePad * 2) : node.height || 48;
    const relX = vp.x + innerX * vp.scale;
    const relY = vp.y + innerY * vp.scale;
    const sw = Math.max(innerW * vp.scale, 48);
    const sh = Math.max(innerH * vp.scale, 28);
    const stageRect = stage.container().getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    return {
      left: stageRect.left - shellRect.left + relX,
      top: stageRect.top - shellRect.top + relY,
      width: sw,
      height: sh,
      fontSize: (node.style?.fontSize || (isNote ? 16 : 18)) * vp.scale,
      rotation: node.rotation || 0,
    };
  }, [resolveTextNode]);

  const commitTextEditor = useCallback(() => {
    setTextEditor((current) => {
      if (!current) return null;
      lastPlacedTextRef.current = null;
      const ta = textAreaRef.current;
      const value = ta && typeof ta.value === "string" ? ta.value : (current.value ?? "");
      if (value === current.baseline) {
        return null;
      }
      emitOp({ type: "node:update", nodeId: current.nodeId, patch: { text: value } });
      return null;
    });
  }, [emitOp]);

  /** Saves textarea content and closes the editor. Mousedown on the stage runs before blur; call this first so we do not lose edits (e.g. text tool spawning a new node would reset editor state). Returns whether an editor was open. */
  const flushActiveTextEditor = useCallback(() => {
    const editing = textEditorRef.current;
    if (!editing) return false;
    const ta = textAreaRef.current;
    const value = ta && typeof ta.value === "string" ? ta.value : (editing.value ?? "");
    lastPlacedTextRef.current = null;
    skipNextTextBlurCommitRef.current = true;
    if (value !== editing.baseline) {
      emitOp({ type: "node:update", nodeId: editing.nodeId, patch: { text: value } });
    }
    setTextEditor(null);
    textEditorRef.current = null;
    return true;
  }, [emitOp]);

  const cancelTextEditor = useCallback(() => {
    setTextEditor((current) => {
      if (!current) {
        lastPlacedTextRef.current = null;
        textEditorRef.current = null;
        return null;
      }
      const ta = textAreaRef.current;
      const live = ta && typeof ta.value === "string" ? ta.value : current.value;
      if (current.baseline !== live) {
        emitOp({ type: "node:update", nodeId: current.nodeId, patch: { text: current.baseline ?? "" } });
      }
      lastPlacedTextRef.current = null;
      textEditorRef.current = null;
      return null;
    });
  }, [emitOp]);

  const beginTextEdit = useCallback(
    (node) => {
      if (readOnly || !node?.id) return;
      if (node.type !== "text" && node.type !== "note") return;
      const live = resolveTextNode(node.id) || node;
      const initial = live.text ?? "";
      const surface = node.type === "note" ? "note" : "text";
      setTextEditor({ nodeId: node.id, value: initial, baseline: initial, surface });
    },
    [readOnly, resolveTextNode],
  );

  useLayoutEffect(() => {
    if (!textEditor) {
      setTextEditLayout(null);
      return;
    }
    const layout = computeTextEditLayout(textEditor.nodeId);
    setTextEditLayout(layout);
    requestAnimationFrame(() => {
      const el = textAreaRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  }, [textEditor, computeTextEditLayout, viewport, stageSize, nodes]);

  useEffect(() => {
    if (!textEditor) return;
    if (!resolveTextNode(textEditor.nodeId)) {
      setTextEditor(null);
      lastPlacedTextRef.current = null;
      textEditorRef.current = null;
    }
  }, [textEditor, nodes, resolveTextNode]);

  const jumpToNode = useCallback(
    (nodeId) => {
      const node = nodesMapRef.current?.get(nodeId);
      const rect = canvasShellRef.current?.getBoundingClientRect();
      if (!node || !rect) return;
      const scale = Math.min(1.5, Math.max(0.7, viewport.scale));
      setSelectedId(nodeId);
      setViewport({
        scale,
        x: rect.width / 2 - (node.x + (node.width || 0) / 2) * scale,
        y: rect.height / 2 - (node.y + (node.height || 0) / 2) * scale,
      });
    },
    [viewport.scale],
  );

  const controller = useMemo(
    () => ({
      setTool(tool) {
        activeToolRef.current = tool;
      },
      zoomIn() {
        setViewport((current) => ({ ...current, scale: Math.min(current.scale * 1.2, 3) }));
      },
      zoomOut() {
        setViewport((current) => ({ ...current, scale: Math.max(current.scale / 1.2, 0.25) }));
      },
      resetZoom() {
        setViewport({ x: 0, y: 0, scale: 1 });
      },
      zoomToFit() {
        const rect = canvasShellRef.current?.getBoundingClientRect();
        const currentNodes = nodesRef.current;
        if (!rect || currentNodes.length === 0) {
          setViewport({ x: 0, y: 0, scale: 1 });
          return;
        }
        const minX = Math.min(...currentNodes.map((node) => node.x));
        const minY = Math.min(...currentNodes.map((node) => node.y));
        const maxX = Math.max(...currentNodes.map((node) => node.x + (node.width || 0)));
        const maxY = Math.max(...currentNodes.map((node) => node.y + (node.height || 0)));
        const width = Math.max(maxX - minX, 1);
        const height = Math.max(maxY - minY, 1);
        const scale = Math.min(rect.width / (width + 160), rect.height / (height + 160), 1.5);
        setViewport({
          scale,
          x: rect.width / 2 - (minX + width / 2) * scale,
          y: rect.height / 2 - (minY + height / 2) * scale,
        });
      },
      zoomToBounds(node) {
        if (node?.id) jumpToNode(node.id);
      },
      zoomToSelection() {
        if (selectedIdRef.current) jumpToNode(selectedIdRef.current);
      },
      jumpToNode,
      selectNode(nodeId) {
        setSelectedId(nodeId);
      },
      select(nodeId) {
        setSelectedId(nodeId);
      },
      getNodes() {
        return nodesRef.current;
      },
      getCurrentPageShapes() {
        return nodesRef.current;
      },
      on(event, callback) {
        if (event !== "change") return () => {};
        window.addEventListener("ligma:canvas-change", callback);
        return () => window.removeEventListener("ligma:canvas-change", callback);
      },
      user: { updateUserPreferences() {} },
    }),
    [jumpToNode],
  );

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("ligma:canvas-change"));
  }, [nodes]);

  useEffect(() => {
    if (onMount) onMount(controller);
    if (exposeJump) exposeJump(jumpToNode);
  }, [controller, exposeJump, jumpToNode, onMount]);

  useEffect(() => {
    function resize() {
      const rect = canvasShellRef.current?.getBoundingClientRect();
      if (rect) setStageSize({ width: rect.width, height: rect.height });
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const doc = new Y.Doc();
    const nodesMap = doc.getMap("nodes");
    docRef.current = doc;
    nodesMapRef.current = nodesMap;
    nodesMap.observe(updateNodesFromDoc);
    updateNodesFromDoc();

    return () => {
      nodesMap.unobserve(updateNodesFromDoc);
      doc.destroy();
      docRef.current = null;
      nodesMapRef.current = null;
    };
  }, [workspaceId, updateNodesFromDoc]);

  useEffect(() => {
    setConnectionStatus?.(connectionState);
  }, [connectionState, setConnectionStatus]);

  useEffect(() => {
    if (!token || !workspaceId || !docRef.current) {
      setConnectionState("offline");
      return undefined;
    }

    setConnectionState("waking");
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    const socket = createCanvasSocket({ workspaceId, token });
    socketRef.current = socket;

    const handleReconnectAttempt = (attempt) => {
      reconnectAttemptRef.current = attempt;
      setReconnectAttempt(attempt);
      setConnectionState(attempt <= 2 ? "waking" : "reconnecting");
    };

    const handleReconnect = () => {
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      setConnectionState("online");
    };

    const handleReconnectFailed = () => {
      setConnectionState("error");
    };

    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.io.on("reconnect", handleReconnect);
    socket.io.on("reconnect_failed", handleReconnectFailed);

    socket.on("connect", () => {
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      setConnectionState("online");
      // Always request a full Yjs merge from the server. We do not persist the Y.Doc locally;
      // sessionStorage may hold a "caught up" sequence after a prior tab session. Sending that
      // value makes the server skip replay while this tab's Y.Doc is still empty — canvas looks cleared after reload.
      socket.emit("canvas:hello", { lastSequenceNum: 0 });
    });
    socket.on("server:ready", (payload) => {
      if (payload?.socketId) {
        localSocketIdRef.current = payload.socketId;
      }
    });
    socket.on("canvas:cursor", (payload) => {
      const sid = payload?.socketId;
      if (!sid || sid === localSocketIdRef.current) return;
      setRemoteCursors((prev) => ({
        ...prev,
        [sid]: {
          socketId: sid,
          userId: payload.userId,
          username: payload.username || "User",
          color: payload.color || "#6366f1",
          x: Number(payload.x),
          y: Number(payload.y),
          t: Date.now(),
        },
      }));
    });
    socket.on("canvas:cursor:leave", (payload) => {
      const sid = payload?.socketId;
      if (!sid) return;
      setRemoteCursors((prev) => {
        const next = { ...prev };
        delete next[sid];
        return next;
      });
    });
    socket.on("disconnect", (_reason) => {
      setConnectionState(socket.active ? "reconnecting" : "offline");
      localSocketIdRef.current = null;
      setRemoteCursors({});
    });
    socket.on("connect_error", () => {
      setConnectionState(reconnectAttemptRef.current <= 2 ? "waking" : "error");
    });
    socket.on("canvas:delta", (payload) => {
      const update = decodeYjsUpdate(payload?.update);
      if (!update || !docRef.current) return;
      Y.applyUpdate(docRef.current, update);
      if (payload.sequenceNum !== undefined && payload.sequenceNum !== null) {
        window.sessionStorage.setItem(`ligma:canvas:${workspaceId}:sequence`, String(payload.sequenceNum));
      }
    });
    socket.on("canvas:rejected", (payload) => {
      window.dispatchEvent(
        new CustomEvent("ligma:rbac-toast", {
          detail: { message: payload?.message || "Canvas operation rejected." },
        }),
      );
    });
    socket.on("workspace:role_updated", (payload) => {
      window.dispatchEvent(new CustomEvent("ligma:role-updated", { detail: payload || {} }));
    });
    socket.on("task:sync", () => {
      window.dispatchEvent(new CustomEvent("ligma:tasks-sync"));
    });

    return () => {
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.io.off("reconnect", handleReconnect);
      socket.io.off("reconnect_failed", handleReconnectFailed);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, workspaceId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [key, c] of Object.entries(next)) {
          if (now - (c.t || 0) > CURSOR_STALE_MS) {
            delete next[key];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  function emitCursorPosition() {
    const sock = socketRef.current;
    if (!sock?.connected) return;
    const now = Date.now();
    if (now - lastCursorEmitRef.current < CURSOR_EMIT_MS) return;
    lastCursorEmitRef.current = now;
    const pointer = getStagePointer();
    if (!pointer) return;
    sock.emit("canvas:cursor:move", { x: pointer.x, y: pointer.y });
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.target?.closest?.(".canvas-text-edit")) return;
      const key = String(event.key || "").toLowerCase();
      if ((key !== "delete" && key !== "backspace") || !selectedId || readOnly) return;
      const node = nodesMapRef.current?.get(selectedId);
      if (!node) return;
      const ownerId = node.metadata?.ownerId || node.metadata?.authorId;

      if (currentUserRole === "contributor" && ownerId && String(ownerId) !== String(currentUserId)) {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent("ligma:rbac-toast", {
            detail: { message: "Contributors can't delete other members' work." },
          }),
        );
        return;
      }

      event.preventDefault();
      emitOp({ type: "node:delete", nodeId: selectedId });
      setSelectedId(null);
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [currentUserId, currentUserRole, emitOp, readOnly, selectedId]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const selectedNode = textEditor ? null : selectedId ? nodeRefs.current.get(selectedId) : null;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, nodes, textEditor]);

  function handleStageMouseDown(event) {
    if (readOnly) return;
    const closedTextEditorOnThisDown = flushActiveTextEditor();
    const clickedStage = event.target === event.target.getStage();
    const tool = activeToolRef.current;

    if (clickedStage && tool === "select") {
      setSelectedId(null);
      return;
    }

    if (tool === "hand") return;
    const pointer = getStagePointer();
    if (!pointer) return;

    if (["geo", "text", "note", "arrow"].includes(tool)) {
      if ((tool === "text" || tool === "note") && closedTextEditorOnThisDown) {
        return;
      }
      const node = makeNode(tool === "geo" ? "rect" : tool, pointer, collabUser, nodes.length + 1);
      if (tool === "text") {
        lastPlacedTextRef.current = node;
        setTextEditor({ nodeId: node.id, value: "", baseline: "", surface: "text" });
      }
      if (tool === "note") {
        lastPlacedTextRef.current = node;
        setTextEditor({ nodeId: node.id, value: "", baseline: "", surface: "note" });
      }
      emitOp({ type: "node:create", node });
      setSelectedId(node.id);
      return;
    }

    if (tool === "draw") {
      const node = makeNode("draw", pointer, collabUser, nodes.length + 1);
      isDrawingRef.current = true;
      drawingNodeRef.current = node;
      emitOp({ type: "node:create", node });
      setSelectedId(node.id);
      return;
    }

    if (tool === "eraser" && event.target?.attrs?.nodeId) {
      emitOp({ type: "node:delete", nodeId: event.target.attrs.nodeId });
      setSelectedId(null);
    }
  }

  function handleStageMouseMove() {
    emitCursorPosition();
    if (!isDrawingRef.current || !drawingNodeRef.current) return;
    const pointer = getStagePointer();
    if (!pointer) return;
    const node = drawingNodeRef.current;
    node.points = [...node.points, pointer.x, pointer.y];
    emitOp({ type: "node:update", nodeId: node.id, patch: { points: node.points } });
  }

  function handleStageMouseUp() {
    isDrawingRef.current = false;
    drawingNodeRef.current = null;
  }

  function handleWheel(event) {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const oldScale = viewport.scale;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale,
    };
    const newScale = event.evt.deltaY > 0 ? oldScale / 1.05 : oldScale * 1.05;
    const clampedScale = Math.min(3, Math.max(0.25, newScale));
    setViewport({
      scale: clampedScale,
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  }

  function updateNode(nodeId, patch) {
    emitOp({ type: "node:update", nodeId, patch });
  }

  function renderNode(node) {
    const commonProps = {
      key: node.id,
      ref: (ref) => {
        if (ref) nodeRefs.current.set(node.id, ref);
        else nodeRefs.current.delete(node.id);
      },
      nodeId: node.id,
      x: node.x,
      y: node.y,
      rotation: node.rotation || 0,
      draggable: !readOnly && activeToolRef.current === "select",
      onClick: () => setSelectedId(node.id),
      onTap: () => setSelectedId(node.id),
      onDragEnd: (event) => updateNode(node.id, { x: event.target.x(), y: event.target.y() }),
      onTransformEnd: (event) => {
        const target = event.target;
        const scaleX = target.scaleX();
        const scaleY = target.scaleY();
        target.scaleX(1);
        target.scaleY(1);
        updateNode(node.id, {
          x: target.x(),
          y: target.y(),
          width: Math.max(20, (node.width || target.width()) * scaleX),
          height: Math.max(20, (node.height || target.height()) * scaleY),
          rotation: target.rotation(),
        });
      },
    };

    if (node.type === "text") {
      const editingThis = textEditor?.nodeId === node.id;
      return (
        <Text
          {...commonProps}
          text={node.text || "\u00a0"}
          width={node.width}
          height={node.height}
          fill="#e2e8f0"
          fontSize={node.style?.fontSize || 18}
          visible={!editingThis}
          onDblClick={(e) => {
            e.evt?.stopPropagation?.();
            beginTextEdit(node);
          }}
          onDblTap={(e) => {
            e.evt?.stopPropagation?.();
            beginTextEdit(node);
          }}
        />
      );
    }

    if (node.type === "note") {
      const editingThis = textEditor?.nodeId === node.id;
      return (
        <React.Fragment key={node.id}>
          <Rect
            {...commonProps}
            width={node.width}
            height={node.height}
            fill={node.style?.fill || "#facc15"}
            stroke={node.style?.stroke || "#eab308"}
            strokeWidth={node.style?.strokeWidth || 2}
            cornerRadius={12}
            shadowBlur={12}
            shadowOpacity={0.25}
            onDblClick={(e) => {
              e.evt?.stopPropagation?.();
              beginTextEdit(node);
            }}
            onDblTap={(e) => {
              e.evt?.stopPropagation?.();
              beginTextEdit(node);
            }}
          />
          <Text
            x={node.x + 12}
            y={node.y + 12}
            width={Math.max(20, node.width - 24)}
            height={Math.max(20, node.height - 24)}
            text={node.text || "\u00a0"}
            fill="#1f2937"
            fontSize={node.style?.fontSize || 16}
            listening={false}
            visible={!editingThis}
          />
        </React.Fragment>
      );
    }

    if (node.type === "arrow") {
      return (
        <Arrow
          {...commonProps}
          points={node.points?.length ? node.points : [0, 0, node.width || 120, 0]}
          stroke={node.style?.stroke || "#e2e8f0"}
          fill={node.style?.stroke || "#e2e8f0"}
          strokeWidth={node.style?.strokeWidth || 2}
          pointerLength={12}
          pointerWidth={12}
        />
      );
    }

    if (node.type === "draw") {
      return (
        <Line
          {...commonProps}
          x={0}
          y={0}
          points={node.points || []}
          stroke={node.style?.stroke || "#e2e8f0"}
          strokeWidth={node.style?.strokeWidth || 2}
          tension={0.35}
          lineCap="round"
          lineJoin="round"
        />
      );
    }

    return (
      <Rect
        {...commonProps}
        width={node.width}
        height={node.height}
        fill={node.style?.fill || "rgba(99, 102, 241, 0.18)"}
        stroke={node.metadata?.lockedBy ? "#f97316" : node.style?.stroke || "#818cf8"}
        strokeWidth={node.style?.strokeWidth || 2}
        cornerRadius={8}
      />
    );
  }

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
          style={{ left: rbacToast.anchorClientX, top: rbacToast.anchorClientY }}
        >
          {rbacToast.message}
        </div>
      ) : null}
      {connectionState !== "online" ? (
        <div className="ws-loading">
          <div className="ws-loading-spinner" />
          <div className="ws-loading-copy">
            <strong>{CONNECTION_MESSAGES[connectionState] || CONNECTION_MESSAGES.disconnected}</strong>
            <span>
              Free hosting can take 30-60 seconds to wake. Your canvas will resync automatically.
              {reconnectAttempt > 0 ? ` Attempt ${reconnectAttempt}/30.` : ""}
            </span>
          </div>
        </div>
      ) : null}
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        draggable={!readOnly && activeTool === "hand"}
        onDragEnd={(event) => setViewport((current) => ({ ...current, x: event.target.x(), y: event.target.y() }))}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchStart={handleStageMouseDown}
        onTouchMove={handleStageMouseMove}
        onTouchEnd={handleStageMouseUp}
        onWheel={handleWheel}
      >
        <Layer listening={false}>
          {gridMode
            ? Array.from({ length: 80 }).map((_, index) => (
                <React.Fragment key={index}>
                  <Line points={[index * 80 - 3200, -3200, index * 80 - 3200, 3200]} stroke="rgba(148,163,184,0.12)" strokeWidth={1} />
                  <Line points={[-3200, index * 80 - 3200, 3200, index * 80 - 3200]} stroke="rgba(148,163,184,0.12)" strokeWidth={1} />
                </React.Fragment>
              ))
            : null}
        </Layer>
        <Layer>
          {nodes.map(renderNode)}
          {selectedId && !textEditor ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled
              enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
            />
          ) : null}
          {nodes
            .filter((node) => node.metadata?.lockedBy)
            .map((node) => (
              <Circle
                key={`${node.id}:lock`}
                x={node.x + (node.width || 0)}
                y={node.y}
                radius={5}
                fill="#f97316"
                listening={false}
              />
            ))}
        </Layer>
        <Layer listening={false}>
          {Object.values(remoteCursors).map((c) => (
            <Group key={c.socketId} x={c.x} y={c.y} listening={false}>
              <Line
                points={REMOTE_CURSOR_ARROW}
                closed
                fill={c.color}
                stroke="#0f172a"
                strokeWidth={1.25}
                lineJoin="round"
                listening={false}
              />
              <Text
                x={16}
                y={4}
                text={c.username}
                fill="#f8fafc"
                fontSize={11}
                fontStyle="600"
                listening={false}
                shadowColor="rgba(0,0,0,0.85)"
                shadowBlur={6}
                shadowOffsetX={0}
                shadowOffsetY={1}
              />
            </Group>
          ))}
        </Layer>
      </Stage>
      {textEditor && textEditLayout && !readOnly ? (
        <textarea
          ref={textAreaRef}
          className={`canvas-text-edit${textEditor.surface === "note" ? " canvas-text-edit--note" : ""}`}
          aria-label={textEditor.surface === "note" ? "Sticky note text" : "Canvas text"}
          value={textEditor.value}
          onChange={(e) =>
            setTextEditor((prev) => (prev ? { ...prev, value: e.target.value } : null))
          }
          onBlur={() => {
            if (skipNextTextBlurCommitRef.current) {
              skipNextTextBlurCommitRef.current = false;
              return;
            }
            commitTextEditor();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              skipNextTextBlurCommitRef.current = true;
              cancelTextEditor();
            }
          }}
          style={{
            left: textEditLayout.left,
            top: textEditLayout.top,
            width: textEditLayout.width,
            minHeight: textEditLayout.height,
            fontSize: textEditLayout.fontSize,
            lineHeight: 1.25,
            transform: textEditLayout.rotation ? `rotate(${textEditLayout.rotation}deg)` : undefined,
            transformOrigin: "top left",
          }}
        />
      ) : null}
      {nodes.length === 0 && connectionState === "online" ? (
        <div className="canvas-empty-hint">Choose a tool and click the canvas to create your first node.</div>
      ) : null}
    </div>
  );
}
