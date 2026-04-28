import { apiFetch } from "./api";

/**
 * Normalized replay step for time travel (decoupled from DB/API field names).
 * @typedef {{ sequenceNum: number | null, tldrawPayload: object }} CanvasReplayFrame
 */

/**
 * @param {string} workspaceId
 * @returns {Promise<CanvasReplayFrame[]>}
 */
export async function fetchCanvasReplayFrames(workspaceId) {
  if (!workspaceId) {
    return [];
  }

  const payload = await apiFetch(`/api/workspaces/${workspaceId}/canvas-events`);

  const rawEvents = payload?.events;
  if (!Array.isArray(rawEvents)) {
    return [];
  }

  return rawEvents
    .filter((e) => e && e.eventType === "tldraw_update" && e.payload)
    .map((e) => ({
      sequenceNum:
        e.sequenceNum != null ? Number(e.sequenceNum) : e.sequence_num != null
          ? Number(e.sequence_num)
          : null,
      tldrawPayload: e.payload,
    }));
}
