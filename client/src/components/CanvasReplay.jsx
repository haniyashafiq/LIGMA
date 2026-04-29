import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Arrow, Layer, Line, Rect, Stage, Text } from "react-konva";
import { FiPause, FiPlay, FiRefreshCw, FiSkipBack, FiSkipForward } from "react-icons/fi";
import * as Y from "yjs";
import { apiFetch } from "../net/api";

const PLAY_INTERVAL_MS = 850;

function decodeYjsUpdate(update) {
  if (!update) return null;
  if (update instanceof Uint8Array) return update;
  if (update instanceof ArrayBuffer) return new Uint8Array(update);
  if (Array.isArray(update)) return Uint8Array.from(update);
  if (update.type === "Buffer" && Array.isArray(update.data)) return Uint8Array.from(update.data);
  if (typeof update === "object") return Uint8Array.from(Object.values(update));
  return null;
}

function getNodesMap(doc) {
  return doc.getMap("nodes");
}

function getMeta(node) {
  return node && typeof node.metadata === "object" && node.metadata ? node.metadata : {};
}

function applySemanticEvent(doc, event) {
  const nodes = getNodesMap(doc);
  const payload = event.payload || {};
  const nodeId = event.nodeId || payload.nodeId || payload.node?.id;

  switch (event.eventType) {
    case "canvas:node:create":
    case "canvas:node:update":
    case "canvas:intent:classified":
      if (payload.node?.id) nodes.set(payload.node.id, payload.node);
      break;
    case "canvas:node:delete":
      if (nodeId) nodes.delete(nodeId);
      break;
    case "canvas:node:lock": {
      const node = nodes.get(nodeId);
      if (node) {
        nodes.set(nodeId, {
          ...node,
          metadata: { ...getMeta(node), lockedBy: payload.lockedBy || event.userId || null },
        });
      }
      break;
    }
    case "canvas:node:unlock": {
      const node = nodes.get(nodeId);
      if (node) nodes.set(nodeId, { ...node, metadata: { ...getMeta(node), lockedBy: null } });
      break;
    }
    case "canvas:node:permission:update": {
      const node = nodes.get(nodeId);
      if (node) {
        nodes.set(nodeId, {
          ...node,
          metadata: { ...getMeta(node), permissions: payload.permissions || {} },
        });
      }
      break;
    }
    default:
      break;
  }
}

function projectNodes(events, sequenceNum) {
  const doc = new Y.Doc();
  const sortedEvents = [...events]
    .filter((event) => Number(event.sequenceNum) <= Number(sequenceNum))
    .sort((a, b) => Number(a.sequenceNum) - Number(b.sequenceNum));

  for (const event of sortedEvents) {
    const update = decodeYjsUpdate(event.yjsUpdate);
    if (update) {
      Y.applyUpdate(doc, update);
    } else {
      doc.transact(() => applySemanticEvent(doc, event), "history-replay");
    }
  }

  const nodes = Array.from(getNodesMap(doc).values()).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  doc.destroy();
  return nodes;
}

function eventLabel(event) {
  const labels = {
    "canvas:node:create": "Created a node",
    "canvas:node:update": "Updated a node",
    "canvas:node:delete": "Deleted a node",
    "canvas:node:lock": "Locked a node",
    "canvas:node:unlock": "Unlocked a node",
    "canvas:node:permission:update": "Changed permissions",
    "canvas:intent:classified": "Classified a node",
  };
  return labels[event?.eventType] || "Workspace changed";
}

function renderReplayNode(node) {
  const commonProps = {
    key: node.id,
    nodeId: node.id,
    x: node.x,
    y: node.y,
    rotation: node.rotation || 0,
    listening: false,
  };

  if (node.type === "text") {
    return (
      <Text
        {...commonProps}
        text={node.text || "\u00a0"}
        width={node.width}
        height={node.height}
        fill="#e2e8f0"
        fontSize={node.style?.fontSize || 18}
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
          text={node.text || "\u00a0"}
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

export default function CanvasReplay({ workspaceId, gridMode = true, onReplayActiveChange }) {
  const shellRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sequenceNum, setSequenceNum] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 700 });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });

  const minSequence = history.length ? Number(history[0].sequenceNum) : 0;
  const maxSequence = history.length ? Number(history[history.length - 1].sequenceNum) : 0;
  const activeSequence = sequenceNum || maxSequence;
  const activeEvent = useMemo(
    () => history.find((event) => Number(event.sequenceNum) === Number(activeSequence)) || null,
    [activeSequence, history],
  );
  const nodes = useMemo(() => projectNodes(history, activeSequence), [history, activeSequence]);

  const loadHistory = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch(`/api/workspaces/${workspaceId}/canvas-history`);
      const events = Array.isArray(payload?.events)
        ? [...payload.events].sort((a, b) => Number(a.sequenceNum) - Number(b.sequenceNum))
        : [];
      setHistory(events);
      setSequenceNum((current) => {
        if (!events.length) return 0;
        const max = Number(events[events.length - 1].sequenceNum);
        return current > 0 ? Math.min(current, max) : max;
      });
    } catch (err) {
      setError(err?.message || "Failed to load canvas history.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    function resize() {
      const rect = shellRef.current?.getBoundingClientRect();
      if (rect) setStageSize({ width: rect.width, height: rect.height });
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [enabled]);

  useEffect(() => {
    if (!playing || !enabled || !history.length) return undefined;
    const id = window.setInterval(() => {
      setSequenceNum((current) => {
        const next = Number(current || minSequence) + 1;
        if (next > maxSequence) {
          setPlaying(false);
          return maxSequence;
        }
        return next;
      });
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, history.length, maxSequence, minSequence, playing]);

  useEffect(() => {
    onReplayActiveChange?.(enabled);
  }, [enabled, onReplayActiveChange]);

  function toggleEnabled() {
    if (!history.length) {
      loadHistory();
    }
    setEnabled((value) => !value);
    setPlaying(false);
  }

  function step(delta) {
    setPlaying(false);
    setSequenceNum((current) => Math.min(maxSequence, Math.max(minSequence, Number(current || minSequence) + delta)));
  }

  function handleWheel(event) {
    event.evt.preventDefault();
    const stage = event.target?.getStage?.();
    const oldScale = viewport.scale;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale,
    };
    const nextScale = event.evt.deltaY > 0 ? oldScale / 1.05 : oldScale * 1.05;
    const scale = Math.min(3, Math.max(0.25, nextScale));
    setViewport({
      scale,
      x: pointer.x - mousePointTo.x * scale,
      y: pointer.y - mousePointTo.y * scale,
    });
  }

  return (
    <>
      <div className="canvas-replay-controls" aria-label="Time travel controls">
        <button type="button" className={enabled ? "active" : ""} onClick={toggleEnabled}>
          Time Travel
        </button>
        <button type="button" onClick={loadHistory} disabled={loading} title="Reload history">
          <FiRefreshCw size={13} />
        </button>
        <button type="button" onClick={() => step(-1)} disabled={!enabled || activeSequence <= minSequence}>
          <FiSkipBack size={13} />
        </button>
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          disabled={!enabled || !history.length}
          title={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? <FiPause size={13} /> : <FiPlay size={13} />}
        </button>
        <button type="button" onClick={() => step(1)} disabled={!enabled || activeSequence >= maxSequence}>
          <FiSkipForward size={13} />
        </button>
        <input
          type="range"
          min={minSequence || 0}
          max={maxSequence || 0}
          value={activeSequence || 0}
          disabled={!enabled || !history.length}
          onChange={(event) => {
            setPlaying(false);
            setSequenceNum(Number(event.target.value));
          }}
        />
        <span className="canvas-replay-meta">
          {history.length ? `Seq ${activeSequence}/${maxSequence}` : loading ? "Loading history..." : "No history"}
        </span>
      </div>

      {error ? <div className="canvas-replay-error">{error}</div> : null}

      {enabled ? (
        <div className="canvas-replay-overlay" ref={shellRef}>
          <div className="canvas-replay-banner">
            <strong>Replay mode</strong>
            <span>
              {activeEvent
                ? `${eventLabel(activeEvent)} at ${new Date(activeEvent.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Scrubbing canvas history"}
            </span>
          </div>
          <Stage
            width={stageSize.width}
            height={stageSize.height}
            x={viewport.x}
            y={viewport.y}
            scaleX={viewport.scale}
            scaleY={viewport.scale}
            draggable
            onDragEnd={(event) => setViewport((current) => ({ ...current, x: event.target.x(), y: event.target.y() }))}
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
            <Layer>{nodes.map(renderReplayNode)}</Layer>
          </Stage>
          {nodes.length === 0 ? <div className="canvas-empty-hint">No canvas nodes at this point in history.</div> : null}
        </div>
      ) : null}
    </>
  );
}
