import { createTLSchema, defaultShapeSchemas } from "@tldraw/tlschema";
import { TLSocketRoom } from "@tldraw/sync-core";

const replaySchemaBase = createTLSchema({
  shapes: { ...defaultShapeSchemas },
});

/** @type {typeof replaySchemaBase} */
export const replaySchema = Object.assign(
  Object.create(Object.getPrototypeOf(replaySchemaBase)),
  replaySchemaBase,
);

replaySchema.migrateStorage = function migrateStorage() {};

const noopSocket = {
  readyState: 1,
  send() {},
  close() {},
  addEventListener() {},
  removeEventListener() {},
};

const REPLAY_SESSION = "time-travel-replay";

/**
 * @param {Array<{ tldrawPayload: object }>} framesSlice
 */
export function buildRoomSnapshotForFrames(framesSlice) {
  const room = new TLSocketRoom({ schema: replaySchema });
  room.handleSocketConnect({ sessionId: REPLAY_SESSION, socket: noopSocket });

  for (const frame of framesSlice) {
    const data = JSON.stringify(frame.tldrawPayload);
    room.handleSocketMessage(REPLAY_SESSION, { data });
  }

  room.handleSocketClose(REPLAY_SESSION);
  const snap = room.getCurrentSnapshot();
  room.close();

  return {
    schema: snap.schema,
    store: Object.fromEntries(
      snap.documents.map((d) => [d.state.id, d.state]),
    ),
  };
}
