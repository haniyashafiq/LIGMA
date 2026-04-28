import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { Arrow, Circle, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
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
    node.text = "Double-click to edit";
    node.style.fill = "transparent";
    node.style.stroke = "transparent";
  }

  if (type === "note") {
    node.text = "Action item: ";
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

  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [rbacToast, setRbacToast] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 700 });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });

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
    return {
      x: (pos.x - viewport.x) / viewport.scale,
      y: (pos.y - viewport.y) / viewport.scale,
    };
  }, [viewport]);

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
  }, [updateNodesFromDoc]);

  useEffect(() => {
    setConnectionStatus?.(connectionState);
  }, [connectionState, setConnectionStatus]);

  useEffect(() => {
    if (!token || !workspaceId || !docRef.current) {
      setConnectionState("offline");
      return undefined;
    }

    const socket = createCanvasSocket({ workspaceId, token });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("online");
      const lastSequenceNum = Number(
        window.sessionStorage.getItem(`ligma:canvas:${workspaceId}:sequence`) || 0,
      );
      socket.emit("canvas:hello", { lastSequenceNum });
    });
    socket.on("disconnect", () => setConnectionState("offline"));
    socket.on("connect_error", () => setConnectionState("error"));
    socket.on("canvas:delta", (payload) => {
      const update = decodeYjsUpdate(payload?.update);
      if (!update || !docRef.current) return;
      Y.applyUpdate(docRef.current, update);
      if (payload.sequenceNum) {
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
    socket.on("task:sync", () => {
      window.dispatchEvent(new CustomEvent("ligma:tasks-sync"));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, workspaceId]);

  useEffect(() => {
    function handleKeyDown(event) {
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
    const selectedNode = selectedId ? nodeRefs.current.get(selectedId) : null;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, nodes]);

  function handleStageMouseDown(event) {
    if (readOnly) return;
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
      const node = makeNode(tool === "geo" ? "rect" : tool, pointer, collabUser, nodes.length + 1);
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

  function editText(node) {
    if (readOnly) return;
    const nextText = window.prompt("Edit canvas text", node.text || "");
    if (nextText !== null) updateNode(node.id, { text: nextText });
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
      return (
        <Text
          {...commonProps}
          text={node.text}
          width={node.width}
          height={node.height}
          fill="#e2e8f0"
          fontSize={node.style?.fontSize || 18}
          onDblClick={() => editText(node)}
          onDblTap={() => editText(node)}
        />
      );
    }

    if (node.type === "note") {
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
          />
          <Text
            x={node.x + 12}
            y={node.y + 12}
            width={Math.max(20, node.width - 24)}
            height={Math.max(20, node.height - 24)}
            text={node.text}
            fill="#1f2937"
            fontSize={node.style?.fontSize || 16}
            listening={false}
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
          Connecting to workspace...
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
          {selectedId ? (
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
      </Stage>
      {nodes.length === 0 && connectionState === "online" ? (
        <div className="canvas-empty-hint">Choose a tool and click the canvas to create your first node.</div>
      ) : null}
    </div>
  );
}
