import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { apiFetch } from "../net/api";
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

function getNodeText(nodeTextsMap, node) {
  const text = node?.id ? nodeTextsMap?.get(node.id) : null;
  if (text && typeof text.toString === "function") {
    return text.toString();
  }
  return typeof node?.text === "string" ? node.text : "";
}

function ensureNodeText(nodeTextsMap, nodeId, initialText = "") {
  if (!nodeTextsMap || !nodeId) return null;
  let text = nodeTextsMap.get(nodeId);
  if (!text) {
    text = new Y.Text();
    nodeTextsMap.set(nodeId, text);
  }
  if (text.length === 0 && initialText) {
    text.insert(0, initialText);
  }
  return text;
}

function diffTextChange(previous = "", next = "") {
  if (previous === next) {
    return null;
  }

  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) {
    start += 1;
  }

  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (previousEnd > start && nextEnd > start && previous[previousEnd - 1] === next[nextEnd - 1]) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  return {
    index: start,
    delete: previousEnd - start,
    insert: next.slice(start, nextEnd),
  };
}

function stripIntentPrefix(text = "") {
  return String(text).replace(/^\[(?:action[_\s-]?item|open[_\s-]?question|decision|reference|general)\]\s*/i, "").trim();
}

function normalizeIntent(intent = "general") {
  return String(intent || "general").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const INTENT_BADGES = {
  action_item: { label: "Action item", fill: "#dcfce7", stroke: "#22c55e", text: "#166534" },
  decision: { label: "Decision", fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af" },
  open_question: { label: "Open question", fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
  reference: { label: "Reference", fill: "#f1f5f9", stroke: "#94a3b8", text: "#334155" },
  general: { label: "General", fill: "#f3e8ff", stroke: "#a855f7", text: "#6b21a8" },
};

function getIntentBadge(intent) {
  return INTENT_BADGES[normalizeIntent(intent)] || null;
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
    width: type === "text" ? 280 : 200,
    height: type === "text" ? 64 : 200,
    rotation: 0,
    zIndex,
    text: "",
    points: [],
    style: {
      fill: type === "note" ? "#facc15" : "rgba(99, 102, 241, 0.18)",
      stroke: type === "note" ? "#eab308" : "#818cf8",
      strokeWidth: 2,
      fontSize: type === "note" ? 18 : 20,
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
    node.points = [0, 0];
    node.style.stroke = "#e2e8f0";
  }

  if (type === "circle") {
    node.width = 0;
    node.height = 0;
  }

  if (type === "triangle") {
    node.width = 0;
    node.height = 0;
  }

  return node;
}

function classifyIntent(text, nodeType = "note") {
  return apiFetch("/api/ai/classify", {
    method: "POST",
    body: JSON.stringify({ message: text, nodeType }),
  })
    .then((data) => ({
      intent: data.intent || "general",
      status: data.status || "todo",
    }))
    .catch((err) => {
      console.error("AI classification failed:", err);
      return { intent: "general", status: "todo" };
    });
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
  const { token, exposeJump, setConnectionStatus, user } = useContext(AppContext);
  const canvasShellRef = useRef(null);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const socketRef = useRef(null);
  const docRef = useRef(null);
  const nodesMapRef = useRef(null);
  const nodeTextsMapRef = useRef(null);
  const nodesRef = useRef([]);
  const remoteCursorsRef = useRef({});
  const selectedIdRef = useRef(null);
  const activeToolRef = useRef(activeTool);
  const isDrawingRef = useRef(false);
  const isErasingRef = useRef(false);
  const erasedNodeIdsRef = useRef(new Set());
  const lastErasePointerRef = useRef(null);
  const drawingNodeRef = useRef(null);
  const drawingStartPosRef = useRef(null);
  const lastPointerRef = useRef(null);
  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });
  const lastCursorEmitRef = useRef(0);
  const lastDrawEmitRef = useRef(0);
  const localSocketIdRef = useRef(null);
  const lastPlacedTextRef = useRef(null);
  const textAreaRef = useRef(null);
  const skipNextTextBlurCommitRef = useRef(false);
  const textEditorRef = useRef(null);
  const lastValueRef = useRef("");
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
  const [isDrawingState, setIsDrawingState] = useState(false);

  useEffect(() => {
    textEditorRef.current = textEditor;
  }, [textEditor]);

  useEffect(() => {
    remoteCursorsRef.current = remoteCursors;
  }, [remoteCursors]);

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

  // Handle Resize
  useEffect(() => {
    const shell = canvasShellRef.current;
    if (!shell) return undefined;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setStageSize({ width, height });
      }
    });

    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!rbacToast) return undefined;
    const id = window.setTimeout(() => setRbacToast(null), 3400);
    return () => window.clearTimeout(id);
  }, [rbacToast]);

  const applyOpLocally = useCallback((op) => {
    const doc = docRef.current;
    const map = nodesMapRef.current;
    const textMap = nodeTextsMapRef.current;
    if (!doc || !map) return;

    doc.transact(() => {
      const type = op.type;
      const nodeId = op.nodeId || op.node?.id;

      if (type === "node:create" && op.node) {
        map.set(op.node.id, op.node);
        ensureNodeText(textMap, op.node.id, op.node.text || "");
      } else if (type === "node:update" && nodeId) {
        const current = map.get(nodeId);
        if (current) {
          map.set(nodeId, { ...current, ...op.patch });
        }
      } else if (type === "node:delete" && nodeId) {
        map.delete(nodeId);
        textMap?.delete(nodeId);
      }
    }, "local");
  }, []);

  const updateNodesFromDoc = useCallback(() => {
    const map = nodesMapRef.current;
    const textMap = nodeTextsMapRef.current;
    if (!map) return;
    const nextNodes = Array.from(map.values())
      .map((node) => ({
        ...node,
        text: getNodeText(textMap, node),
      }))
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    // Only update if something actually changed to prevent render loops
    const currentNodes = nodesRef.current;
    const hasChanged = nextNodes.length !== currentNodes.length || 
                      nextNodes.some((n, i) => n.id !== currentNodes[i]?.id || n.text !== currentNodes[i]?.text);
    
    if (hasChanged) {
      setNodes(nextNodes);
    }
    setTextEditor((current) => {
      if (!current) return current;
      const live = nextNodes.find((node) => node.id === current.nodeId);
      if (!live || live.text === current.value) return current;
      // If user hasn't changed anything yet, adopt the live text
      if (current.value === current.baseline) {
        lastValueRef.current = live.text;
        return { ...current, value: live.text, baseline: live.text };
      }
      return current;
    });
  }, []);

  const emitOp = useCallback(
    (op) => {
      if (readOnly || !socketRef.current?.connected) return;
      
      // Text uses the textarea state for instant feedback. Let the server's
      // Yjs update be the single source written into this Y.Doc, otherwise the
      // echo becomes a second CRDT author and inserts duplicate characters.
      if (op.type !== "node:text:delta") {
        applyOpLocally(op);
      }

      socketRef.current.emit("canvas:op", {
        ...op,
        opId:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}:${Math.random()}`,
      });
    },
    [readOnly, applyOpLocally],
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

  const getCanvasNodeId = useCallback((konvaNode) => {
    let current = konvaNode;
    while (current) {
      const nodeId = current.attrs?.nodeId;
      if (nodeId) return nodeId;
      current = typeof current.getParent === "function" ? current.getParent() : null;
    }
    return null;
  }, []);

  const resolveTextNode = useCallback((nodeId) => {
    const node =
      nodesMapRef.current?.get(nodeId) ||
      (lastPlacedTextRef.current?.id === nodeId ? lastPlacedTextRef.current : null) ||
      nodesRef.current.find((n) => n.id === nodeId) ||
      null;
    if (!node) return null;
    return {
      ...node,
      text: getNodeText(nodeTextsMapRef.current, node),
    };
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
    const sw = Math.max(innerW * vp.scale, 80);
    const sh = Math.max(innerH * vp.scale, 40);
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

  const emitTextChange = useCallback(
    (nodeId, nextValue) => {
      const previousValue = lastValueRef.current;
      const delta = diffTextChange(previousValue, nextValue);
      if (!delta) return;
      lastValueRef.current = nextValue;
      emitOp({ type: "node:text:delta", nodeId, delta });
    },
    [emitOp],
  );

  const handleAITrigger = useCallback(async (nodeId, text) => {
    if (!text || text.length < 2) return;
    
    // Check if it's a note or text node
    const node = resolveTextNode(nodeId);
    if (!node || (node.type !== 'note' && node.type !== 'text')) return;

    const cleanText = stripIntentPrefix(text);
    if (cleanText.length < 2) return;

    const result = await classifyIntent(cleanText, node.type);
    const { intent, status } = result;
    const dbIntent = normalizeIntent(intent);

    if (dbIntent === 'action_item') {
      await apiFetch(`/api/workspaces/${workspaceId}/tasks/node/${nodeId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: cleanText,
          status: status || 'todo',
          intent: 'action_item',
          source: 'ai',
          sourceAuthorId: user?.id,
          sourceAuthorName: user?.displayName || user?.username
        })
      });
      window.dispatchEvent(new CustomEvent('ligma:tasks-sync'));
    } else {
      // If it was a task but now it's something else, remove it
      await apiFetch(`/api/workspaces/${workspaceId}/tasks/node/${nodeId}`, {
        method: 'DELETE'
      });
      window.dispatchEvent(new CustomEvent('ligma:tasks-sync'));
    }
  }, [resolveTextNode, workspaceId, user]);

  const commitTextEditor = useCallback(() => {
    setTextEditor((current) => {
      if (!current) return null;
      lastPlacedTextRef.current = null;
      const ta = textAreaRef.current;
      const value = ta && typeof ta.value === "string" ? ta.value : (current.value ?? "");
      
      if (value !== lastValueRef.current) {
        emitTextChange(current.nodeId, value);
      }
      
      if (value !== current.baseline) {
        handleAITrigger(current.nodeId, value);
      }
      return null;
    });
  }, [emitTextChange, handleAITrigger]);

  /** Saves textarea content and closes the editor. Mousedown on the stage runs before blur; call this first so we do not lose edits (e.g. text tool spawning a new node would reset editor state). Returns whether an editor was open. */
  const flushActiveTextEditor = useCallback(() => {
    const editing = textEditorRef.current;
    if (!editing) return false;
    const ta = textAreaRef.current;
    const value = ta && typeof ta.value === "string" ? ta.value : (editing.value ?? "");
    lastPlacedTextRef.current = null;
    skipNextTextBlurCommitRef.current = true;
    if (value !== lastValueRef.current) {
      emitTextChange(editing.nodeId, value);
    }
    
    // Optimistic local update to prevent "disappearing" text flicker
    const node = nodesMapRef.current?.get(editing.nodeId);
    if (node) {
      const liveTextNode = nodeTextsMapRef.current?.get(editing.nodeId);
      // We don't want to conflict with Yjs, but for visual continuity:
      setNodes(prev => prev.map(n => n.id === editing.nodeId ? { ...n, text: value } : n));
    }

    // Final force sync to nodes state for instant visual
    updateNodesFromDoc();
    if (value !== editing.baseline) {
      handleAITrigger(editing.nodeId, value);
    }
    setTextEditor(null);
    textEditorRef.current = null;
    return true;
  }, [emitTextChange, handleAITrigger]);

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
        emitTextChange(current.nodeId, current.baseline ?? "");
      }
      lastPlacedTextRef.current = null;
      textEditorRef.current = null;
      return null;
    });
  }, [emitTextChange]);

  const beginTextEdit = useCallback(
    (node) => {
      if (readOnly || !node?.id) return;
      if (node.type !== "text" && node.type !== "note") return;
      const live = resolveTextNode(node.id) || node;
      const initial = live.text ?? "";
      const surface = node.type === "note" ? "note" : "text";
      lastValueRef.current = initial;
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
    if (layout) {
      setTextEditLayout(prev => {
        if (prev && 
            prev.left === layout.left && 
            prev.top === layout.top && 
            prev.width === layout.width && 
            prev.height === layout.height && 
            prev.fontSize === layout.fontSize && 
            prev.rotation === layout.rotation) {
          return prev;
        }
        return layout;
      });
    }
    requestAnimationFrame(() => {
      const el = textAreaRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  }, [textEditor?.nodeId, computeTextEditLayout, viewport, stageSize]);

  useEffect(() => {
    if (!textEditor) return;
    if (!resolveTextNode(textEditor.nodeId)) {
      setTextEditor(null);
      lastPlacedTextRef.current = null;
      textEditorRef.current = null;
    }
  }, [textEditor, resolveTextNode]);

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
      jumpToUser(userId) {
        const cursors = Object.values(remoteCursorsRef.current);
        const cursor = cursors.find(c => String(c.userId) === String(userId));
        if (!cursor) return;
        
        const rect = canvasShellRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        setViewport(current => ({
          ...current,
          x: rect.width / 2 - cursor.x * current.scale,
          y: rect.height / 2 - cursor.y * current.scale
        }));
      },
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
      clearAll() {
        if (readOnly) return;
        const currentNodes = nodesRef.current;
        currentNodes.forEach(node => {
          emitOp({ type: "node:delete", nodeId: node.id });
        });
        setSelectedId(null);
      },
      user: { updateUserPreferences() {} },
    }),
    [emitOp, jumpToNode, readOnly],
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
    const nodeTextsMap = doc.getMap("nodeTexts");
    docRef.current = doc;
    nodesMapRef.current = nodesMap;
    nodeTextsMapRef.current = nodeTextsMap;
    nodesMap.observe(updateNodesFromDoc);
    nodeTextsMap.observeDeep(updateNodesFromDoc);
    updateNodesFromDoc();

    return () => {
      nodesMap.unobserve(updateNodesFromDoc);
      nodeTextsMap.unobserveDeep(updateNodesFromDoc);
      doc.destroy();
      docRef.current = null;
      nodesMapRef.current = null;
      nodeTextsMapRef.current = null;
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
    socket.on("task:sync", (payload) => {
      window.dispatchEvent(new CustomEvent("ligma:tasks-sync"));
      if (payload?.deleted && payload.sourceNodeId && !payload.preserveNode) {
        // If a task linked to a canvas node was deleted, remove the note too
        emitOp({ type: "node:delete", nodeId: payload.sourceNodeId });
      }
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

  function eraseNodeById(nodeId) {
    if (!nodeId || erasedNodeIdsRef.current.has(nodeId)) return;
    erasedNodeIdsRef.current.add(nodeId);
    emitOp({ type: "node:delete", nodeId });
    if (selectedIdRef.current === nodeId) {
      setSelectedId(null);
    }
  }

  function eraseAtStagePoint(stage, point) {
    const intersected = stage.getIntersection(point);
    eraseNodeById(getCanvasNodeId(intersected));
  }

  function eraseAlongPointerPath(stage, from, to) {
    if (!from) {
      eraseAtStagePoint(stage, to);
      return;
    }

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / 10));

    for (let index = 1; index <= steps; index += 1) {
      const t = index / steps;
      eraseAtStagePoint(stage, {
        x: from.x + dx * t,
        y: from.y + dy * t,
      });
    }
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

    const isGeo = tool.startsWith("geo:");
    const baseTool = isGeo ? "geo" : tool;

    if (["geo", "text", "note", "arrow", "draw"].includes(baseTool)) {
      if ((tool === "text" || tool === "note") && closedTextEditorOnThisDown) {
        return;
      }

      const nodeType = isGeo ? tool.split(":")[1] : tool;
      const node = makeNode(nodeType, pointer, collabUser, nodes.length + 1);
      
      if (tool === "text") {
        lastPlacedTextRef.current = node;
        setTextEditor({ nodeId: node.id, value: "", baseline: "", surface: "text" });
        emitOp({ type: "node:create", node });
      } else if (tool === "note") {
        lastPlacedTextRef.current = node;
        setTextEditor({ nodeId: node.id, value: "", baseline: "", surface: "note" });
        emitOp({ type: "node:create", node });
      } else {
        // Drag-to-create tools
        isDrawingRef.current = true;
        setIsDrawingState(true);
        drawingNodeRef.current = node;
        drawingStartPosRef.current = pointer;
        
        if (tool === "geo" || tool === "arrow") {
          node.width = 0;
          node.height = 0;
          if (tool === "arrow") node.points = [0, 0, 0, 0];
        }
        
        lastDrawEmitRef.current = Date.now() + 50;
        emitOp({ type: "node:create", node });
      }
      
      setSelectedId(node.id);
      return;
    }

    if (tool === "eraser") {
      isErasingRef.current = true;
      erasedNodeIdsRef.current.clear();
      const stage = event.target?.getStage?.();
      const pointer = stage?.getPointerPosition();
      lastErasePointerRef.current = pointer || null;
      eraseNodeById(getCanvasNodeId(event.target));
    }
  }

  function handleStageMouseMove() {
    emitCursorPosition();

    // Eraser sweep logic
    if (isErasingRef.current && activeToolRef.current === "eraser") {
      const stage = stageRef.current;
      const pos = stage?.getPointerPosition();
      if (pos) {
        eraseAlongPointerPath(stage, lastErasePointerRef.current, pos);
        lastErasePointerRef.current = pos;
      }
    }

    if (!isDrawingRef.current || !drawingNodeRef.current) return;
    const pointer = getStagePointer();
    if (!pointer) return;
    const node = drawingNodeRef.current;
    const start = drawingStartPosRef.current;

    if (node.type === "draw") {
      const relX = pointer.x - node.x;
      const relY = pointer.y - node.y;
      const newPoints = [...node.points, relX, relY];
      node.points = newPoints;

      // 1. Direct Konva update for zero-lag local feedback
      const konvaNode = nodeRefs.current.get(node.id);
      if (konvaNode) {
        konvaNode.points(newPoints);
      }

      // 2. Throttled emit for collaboration sync (approx 30fps)
      const now = Date.now();
      if (now - lastDrawEmitRef.current > 32) {
        lastDrawEmitRef.current = now;
        emitOp({ type: "node:update", nodeId: node.id, patch: { points: newPoints } });
      }
    } else if (node.type === "arrow") {
      const dx = pointer.x - node.x;
      const dy = pointer.y - node.y;
      node.points = [0, 0, dx, dy];
      emitOp({ type: "node:update", nodeId: node.id, patch: { points: node.points } });
    } else {
      // Shape (Rect, etc.)
      const width = pointer.x - node.x;
      const height = pointer.y - node.y;
      node.width = width;
      node.height = height;
      emitOp({ type: "node:update", nodeId: node.id, patch: { width, height } });
    }
  }

  function handleStageMouseUp() {
    if (isDrawingRef.current && drawingNodeRef.current?.type === "draw") {
      // Final sync on release to ensure all points are sent
      emitOp({ 
        type: "node:update", 
        nodeId: drawingNodeRef.current.id, 
        patch: { points: drawingNodeRef.current.points } 
      });
    }
    isDrawingRef.current = false;
    setIsDrawingState(false);
    isErasingRef.current = false;
    erasedNodeIdsRef.current.clear();
    lastErasePointerRef.current = null;
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
    const { key, ...konvaProps } = {
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
      onDragStart: (e) => {
        e.cancelBubble = true;
      },
      onDragEnd: (event) => {
        event.cancelBubble = true;
        updateNode(node.id, { x: event.target.x(), y: event.target.y() });
      },
      onTransformEnd: (event) => {
        event.cancelBubble = true;
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
        <Group key={key} {...konvaProps}>
          <Text
            text={node.text || "\u00a0"}
            width={node.width}
            height={node.height}
            fill="#f8fafc"
            fontSize={node.style?.fontSize || 20}
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
        </Group>
      );
    }

    if (node.type === "note") {
      const editingThis = textEditor?.nodeId === node.id;
      const intentBadge = getIntentBadge(node.metadata?.intent);
      const badgeWidth = intentBadge ? Math.min(Math.max(intentBadge.label.length * 7 + 18, 86), Math.max(86, node.width - 24)) : 0;
      return (
        <Group key={key} {...konvaProps}>
          <Rect
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
            x={12}
            y={12}
            width={Math.max(20, node.width - 24)}
            height={Math.max(20, node.height - (intentBadge ? 48 : 24))}
            text={node.text || "\u00a0"}
            fill="#0f172a"
            fontSize={node.style?.fontSize || 18}
            listening={false}
            visible={!editingThis}
          />
          {intentBadge ? (
            <>
              <Rect
                x={12}
                y={Math.max(12, node.height - 28)}
                width={badgeWidth}
                height={18}
                fill={intentBadge.fill}
                stroke={intentBadge.stroke}
                strokeWidth={1}
                cornerRadius={9}
                listening={false}
              />
              <Text
                x={21}
                y={Math.max(15, node.height - 25)}
                width={Math.max(20, badgeWidth - 18)}
                height={12}
                text={intentBadge.label}
                fill={intentBadge.text}
                fontSize={10}
                fontStyle="bold"
                listening={false}
              />
            </>
          ) : null}
        </Group>
      );
    }

    if (node.type === "arrow") {
      return (
        <Arrow
          key={key}
          {...konvaProps}
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
          key={key}
          {...konvaProps}
          points={node.points || []}
          stroke={node.style?.stroke || "#e2e8f0"}
          strokeWidth={node.style?.strokeWidth || 2}
          tension={0.35}
          lineCap="round"
          lineJoin="round"
        />
      );
    }

    if (node.type === "circle") {
      return (
        <Circle
          key={key}
          {...konvaProps}
          x={node.x + node.width / 2}
          y={node.y + node.height / 2}
          radius={Math.abs(node.width) / 2}
          fill={node.style?.fill || "rgba(99, 102, 241, 0.18)"}
          stroke={node.style?.stroke || "#818cf8"}
          strokeWidth={node.style?.strokeWidth || 2}
        />
      );
    }

    if (node.type === "triangle") {
      return (
        <Line
          key={key}
          {...konvaProps}
          points={[
            node.width / 2, 0,
            node.width, node.height,
            0, node.height
          ]}
          closed
          fill={node.style?.fill || "rgba(99, 102, 241, 0.18)"}
          stroke={node.style?.stroke || "#818cf8"}
          strokeWidth={node.style?.strokeWidth || 2}
        />
      );
    }

    return (
      <Rect
        key={key}
        {...konvaProps}
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
      style={{ 
        cursor: activeTool === "eraser" ? "cell" : 
                activeTool === "draw" ? "crosshair" : 
                "default" 
      }}
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
          {selectedId && !textEditor && !isDrawingState ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled={nodes.find(n => n.id === selectedId)?.type !== "draw"}
              enabledAnchors={
                nodes.find(n => n.id === selectedId)?.type === "draw"
                  ? []
                  : ["top-left", "top-right", "bottom-left", "bottom-right"]
              }
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
          onChange={(e) => {
            const nextValue = e.target.value;
            emitTextChange(textEditor.nodeId, nextValue);
            setTextEditor((prev) => {
              if (!prev) return null;
              return { ...prev, value: nextValue };
            });
          }}
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
            zIndex: 10000,
            display: "block",
            visibility: "visible",
            opacity: 1,
          }}
        />
      ) : null}
      {nodes.length === 0 && connectionState === "online" ? (
        <div className="canvas-empty-hint">Choose a tool and click the canvas to create your first node.</div>
      ) : null}
    </div>
  );
}
