import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  Tldraw,
  createTLStore,
  loadSnapshot,
  inlineBase64AssetStore,
  uniqueId,
} from "tldraw";
import { fetchCanvasReplayFrames } from "../net/canvasEventLog";
import { buildRoomSnapshotForFrames, replaySchema } from "./replayRoom";
import "../styles/canvas.css";

const PLAY_INTERVAL_MS = 600;

export default function TimeTravel({ workspaceId }) {
  const [frames, setFrames] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [fetchDone, setFetchDone] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    setFetchDone(false);

    (async () => {
      try {
        const next = await fetchCanvasReplayFrames(workspaceId);
        if (cancelled) return;
        setFrames(next);
      } catch (e) {
        if (cancelled) return;
        setFrames([]);
        setLoadError(
          e?.message && typeof e.message === "string"
            ? e.message
            : "Could not load history.",
        );
      } finally {
        if (!cancelled) setFetchDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    setFrameIndex(0);
    setPlaying(false);
  }, [frames]);

  const maxIndex = frames.length;

  useEffect(() => {
    if (!playing) {
      if (playRef.current) {
        window.clearInterval(playRef.current);
        playRef.current = null;
      }
      return;
    }

    playRef.current = window.setInterval(() => {
      setFrameIndex((i) => {
        if (i >= maxIndex) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, PLAY_INTERVAL_MS);

    return () => {
      if (playRef.current) {
        window.clearInterval(playRef.current);
        playRef.current = null;
      }
    };
  }, [playing, maxIndex]);

  const documentSnap = useMemo(() => {
    try {
      return buildRoomSnapshotForFrames(frames.slice(0, frameIndex));
    } catch (e) {
      console.error("[TimeTravel] replay failed", e);
      return null;
    }
  }, [frames, frameIndex]);

  const replayStore = useMemo(() => {
    const store = createTLStore({
      id: uniqueId(),
      schema: replaySchema,
      assets: inlineBase64AssetStore,
    });
    if (documentSnap) {
      try {
        loadSnapshot(store, { document: documentSnap });
      } catch (e) {
        console.error("[TimeTravel] loadSnapshot failed", e);
      }
    }
    return store;
  }, [documentSnap]);

  const onReplayMount = useCallback((editor) => {
    try {
      editor.updateInstanceState({ isReadonly: true });
    } catch (_e) {
      // ignore
    }
  }, []);

  const seqLabel =
    frameIndex === 0
      ? "Start"
      : frames[frameIndex - 1]?.sequenceNum != null
        ? `#${frames[frameIndex - 1].sequenceNum}`
        : `step ${frameIndex}`;

  return (
    <div className="time-travel-panel">
      <div className="time-travel-toolbar">
        <span className="time-travel-label">History replay</span>
        <span className="time-travel-frame">
          {fetchDone && !loadError
            ? `${frameIndex} / ${maxIndex} · ${seqLabel}`
            : "—"}
        </span>
        <button
          type="button"
          className="tool-btn"
          disabled={!fetchDone || maxIndex === 0 || loadError}
          onClick={() => setPlaying((p) => !p)}
        >
          {!playing ? "Play" : "Pause"}
        </button>
      </div>

      {loadError ? (
        <p className="time-travel-empty muted-text">{loadError}</p>
      ) : null}
      {!loadError && fetchDone && maxIndex === 0 ? (
        <p className="time-travel-empty muted-text">
          No canvas history recorded yet. Edits will appear here as they are
          saved.
        </p>
      ) : null}

      <input
        type="range"
        className="time-travel-slider"
        min={0}
        max={maxIndex}
        step={1}
        value={Math.min(frameIndex, maxIndex)}
        disabled={!fetchDone || loadError || maxIndex === 0}
        onChange={(e) => {
          setPlaying(false);
          setFrameIndex(Number(e.target.value));
        }}
      />

      <div className="time-travel-canvas">
        <Tldraw
          store={replayStore}
          onMount={onReplayMount}
          autoFocus={false}
          hideUi
        />
      </div>
    </div>
  );
}
