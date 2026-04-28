const { createTLSchema, defaultShapeSchemas } = require("@tldraw/tlschema");
const { TLSocketRoom } = require("@tldraw/sync-core");
const eventService = require("../services/event.service");
const { checkNodePermission } = require("../middleware/rbac");

const baseSchema = createTLSchema({
  shapes: { ...defaultShapeSchemas },
});

const schema = Object.assign(
  Object.create(Object.getPrototypeOf(baseSchema)),
  baseSchema,
);

// TLSyncRoom expects a `migrateStorage(txn)` hook. The StoreSchema returned by
// @tldraw/tlschema in this workspace does not provide one, so we attach a
// compatibility shim here. This keeps the room bootstrap stable for fresh rooms
// without altering the underlying schema instance.
schema.migrateStorage = function migrateStorage() {
  // no-op compatibility shim
};

const rooms = new Map();
const roomPromises = new Map();
const VALUE_OP_PUT = "put";
const VALUE_OP_PATCH = "patch";

function serializeMessageForStorage(message) {
  if (Buffer.isBuffer(message)) {
    return {
      encoding: "base64",
      data: message.toString("base64"),
    };
  }

  if (message instanceof Uint8Array) {
    return {
      encoding: "base64",
      data: Buffer.from(message).toString("base64"),
    };
  }

  if (message instanceof ArrayBuffer) {
    return {
      encoding: "base64",
      data: Buffer.from(new Uint8Array(message)).toString("base64"),
    };
  }

  if (typeof message === "string") {
    return {
      encoding: "utf8",
      data: message,
    };
  }

  if (message && typeof message === "object") {
    return {
      encoding: "json",
      data: message,
    };
  }

  return null;
}

function decodeStoredMessageToBuffer(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.encoding === "base64" && typeof payload.data === "string") {
    return Buffer.from(payload.data, "base64");
  }

  if (payload.encoding === "utf8" && typeof payload.data === "string") {
    return Buffer.from(payload.data, "utf8");
  }

  if (payload.encoding === "json" && payload.data) {
    return Buffer.from(JSON.stringify(payload.data), "utf8");
  }

  // Backward compatibility with older Buffer JSON shape:
  // { type: "Buffer", data: [...] }
  if (payload.type === "Buffer" && Array.isArray(payload.data)) {
    return Buffer.from(payload.data);
  }

  return null;
}

function decodeIncomingSocketMessage(message) {
  if (typeof message === "string") {
    return message;
  }

  if (Buffer.isBuffer(message)) {
    return message.toString("utf8");
  }

  if (message instanceof Uint8Array) {
    return Buffer.from(message).toString("utf8");
  }

  if (message instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(message)).toString("utf8");
  }

  return null;
}

function isShapeRecordId(recordId) {
  return typeof recordId === "string" && recordId.startsWith("shape:");
}

function getShapeOwnerId(shapeRecord) {
  if (!shapeRecord || typeof shapeRecord !== "object") {
    return null;
  }

  return (
    shapeRecord?.meta?.ownerId ??
    shapeRecord?.meta?.createdBy ??
    shapeRecord?.meta?.userId ??
    shapeRecord?.createdById ??
    null
  );
}

function patchTouchesOwnerAcl(patch) {
  const metaPatch = patch?.meta;
  if (!metaPatch || !Array.isArray(metaPatch)) return false;

  const [metaOpType, metaValue] = metaPatch;
  if (metaOpType === VALUE_OP_PUT && metaValue && typeof metaValue === "object") {
    return Object.prototype.hasOwnProperty.call(metaValue, "ownerId");
  }

  if (metaOpType === VALUE_OP_PATCH && metaValue && typeof metaValue === "object") {
    return Object.prototype.hasOwnProperty.call(metaValue, "ownerId");
  }

  return false;
}

function stampOwnerAcl(record, userId) {
  if (!record || typeof record !== "object") return;

  const meta = record.meta && typeof record.meta === "object" ? record.meta : {};
  if (!meta.ownerId) {
    meta.ownerId = userId;
  }
  if (!meta.createdBy) {
    meta.createdBy = userId;
  }
  record.meta = meta;
}

function finalizeFilteredDiff(message) {
  if (!message?.diff || typeof message.diff !== "object") {
    return;
  }

  // Keep `diff` as `{}` when every op was filtered out. If we `delete` diff,
  // TLSyncRoom compares undefined to undefined and wrongly sends action
  // `commit` instead of `discard`, so optimistic local edits never rebase.
  if (Object.keys(message.diff).length === 0) {
    message.diff = {};
  }
}

const TOAST_PRIORITY = {
  leadAcl: 50,
  viewer: 40,
  contributorOther: 30,
  noCreate: 20,
  generic: 10,
};

async function applyNodeLevelRbacToPushMessage(message, room, socket) {
  if (!message || message.type !== "push" || !message.diff) {
    return {
      denied: false,
      createdNodeIds: [],
      keptOps: 0,
      droppedOps: 0,
      toastMessage: null,
      toastPriority: 0,
    };
  }

  const userId = socket.user?.id;
  const workspaceId = socket.workspaceId;
  const workspaceRole = socket.workspaceRole;

  if (!userId || !workspaceId) {
    return {
      denied: false,
      createdNodeIds: [],
      keptOps: 0,
      droppedOps: 0,
      toastMessage: null,
      toastPriority: 0,
    };
  }

  const createdNodeIds = [];
  let denied = false;
  let keptOps = 0;
  let droppedOps = 0;
  let toastPriority = 0;
  let toastMessage = null;
  const nextDiff = {};

  function bumpToast(nextPriority, text) {
    if (nextPriority > toastPriority) {
      toastPriority = nextPriority;
      toastMessage = text;
    }
  }

  for (const [recordId, op] of Object.entries(message.diff)) {
    if (!isShapeRecordId(recordId) || !Array.isArray(op)) {
      nextDiff[recordId] = op;
      keptOps += 1;
      continue;
    }

    const opType = op[0];

    if (opType === "put") {
      const canCreate = await checkNodePermission(
        "create",
        recordId,
        userId,
        workspaceId,
      );
      if (!canCreate) {
        denied = true;
        droppedOps += 1;
        bumpToast(
          TOAST_PRIORITY.noCreate,
          "You can't add canvas content with your current role.",
        );
        continue;
      }

      if (op[1] && typeof op[1] === "object") {
        stampOwnerAcl(op[1], userId);
        createdNodeIds.push(recordId);
      }

      nextDiff[recordId] = op;
      keptOps += 1;
      continue;
    }

    if (opType === "patch") {
      const canEdit = await checkNodePermission("edit", recordId, userId, workspaceId);
      if (!canEdit) {
        denied = true;
        droppedOps += 1;
        bumpToast(
          TOAST_PRIORITY.viewer,
          workspaceRole === "viewer"
            ? "View-only access: you can't edit this workspace."
            : "That edit isn't allowed for your workspace role.",
        );
        continue;
      }

      // Eraser and other tools use patches, not only `remove`. Contributors
      // must not modify others' shapes (lead can).
      if (workspaceRole !== "lead") {
        const currentRecord = room.getRecord(recordId);
        const ownerId = getShapeOwnerId(currentRecord);
        if (ownerId && String(ownerId) !== String(userId)) {
          denied = true;
          droppedOps += 1;
          bumpToast(
            TOAST_PRIORITY.contributorOther,
            "Contributors can't change or remove other members' work.",
          );
          continue;
        }
      }

      // Contributors can edit nodes, but cannot rewrite ACL ownership metadata.
      if (workspaceRole !== "lead" && patchTouchesOwnerAcl(op[1])) {
        denied = true;
        droppedOps += 1;
        bumpToast(
          TOAST_PRIORITY.leadAcl,
          'Only workspace leads can change who "owns" a canvas item.',
        );
        continue;
      }

      nextDiff[recordId] = op;
      keptOps += 1;
      continue;
    }

    if (opType === "remove") {
      const canDelete = await checkNodePermission(
        "delete",
        recordId,
        userId,
        workspaceId,
      );
      if (!canDelete) {
        denied = true;
        droppedOps += 1;
        bumpToast(
          TOAST_PRIORITY.viewer,
          workspaceRole === "viewer"
            ? "View-only access: you can't remove content."
            : "That deletion isn't allowed for your workspace role.",
        );
        continue;
      }

      // Server-authoritative per-node ACL: contributors cannot delete others' nodes.
      if (workspaceRole !== "lead") {
        const currentRecord = room.getRecord(recordId);
        const ownerId = getShapeOwnerId(currentRecord);
        if (ownerId && String(ownerId) !== String(userId)) {
          denied = true;
          droppedOps += 1;
          bumpToast(
            TOAST_PRIORITY.contributorOther,
            "Contributors can't change or remove other members' work.",
          );
          continue;
        }
      }

      nextDiff[recordId] = op;
      keptOps += 1;
      continue;
    }

    nextDiff[recordId] = op;
    keptOps += 1;
  }

  message.diff = nextDiff;
  finalizeFilteredDiff(message);
  return {
    denied,
    createdNodeIds,
    keptOps,
    droppedOps,
    toastMessage,
    toastPriority,
  };
}

function createSocketIoMinimalSocket(socket, room) {
  const listeners = {
    message: new Set(),
    close: new Set(),
    error: new Set(),
  };

  const cleanup = () => {
    socket.off("tldraw-message", onMessage);
    socket.off("disconnect", onDisconnect);
    socket.off("connect_error", onError);
  };

  const onMessage = async (message) => {
    let outgoingMessage = message;
    let shouldSaveToDb = true;

    try {
      const decodedMessage = decodeIncomingSocketMessage(message);
      let createdNodeIds = [];

      if (decodedMessage) {
        try {
          const parsedMessage = JSON.parse(decodedMessage);
          if (parsedMessage?.type === "push") {
            const rbacResult = await applyNodeLevelRbacToPushMessage(
              parsedMessage,
              room,
              socket,
            );
            createdNodeIds = rbacResult.createdNodeIds || [];
            if (rbacResult.droppedOps > 0 && rbacResult.toastMessage) {
              try {
                socket.emit("workspace:rbac_denied", {
                  message: rbacResult.toastMessage,
                });
              } catch (_emitErr) {
                // ignore
              }
            }

            // Check if the diff only contains ephemeral state (pointers, camera, presence)
            const diffKeys = Object.keys(parsedMessage.diff || {});
            const allEphemeral = diffKeys.length > 0 && diffKeys.every(k => 
              k.startsWith('pointer:') || 
              k.startsWith('camera:') || 
              k.startsWith('presence:') || 
              k.startsWith('instance:') ||
              k.startsWith('instance_page_state:') ||
              k.startsWith('instance_presence:')
            );

            if (allEphemeral) {
              shouldSaveToDb = false;
            }

            // Important: do NOT swallow denied pushes. Let TLSyncRoom process
            // the filtered (possibly empty) diff so the client receives a
            // push_result and immediately rebases optimistic local changes.
            outgoingMessage = JSON.stringify(parsedMessage);
          }
        } catch (_error) {
          // Non-JSON/partial chunk message path; forward as-is.
        }
      }

      for (const nodeId of createdNodeIds) {
        await eventService.appendEvent(
          socket.workspaceId,
          socket.user?.id || null,
          "canvas:node:create",
          nodeId,
          { source: "tldraw" },
        );
      }

      const storedPayload = serializeMessageForStorage(outgoingMessage);
      if (storedPayload && shouldSaveToDb) {
        await eventService.appendEvent(
          socket.workspaceId,
          socket.user?.id || null,
          "tldraw_message",
          null,
          storedPayload,
        );
      }
    } catch (e) {
      console.error("[tldraw-sync] Failed to persist update", e);
    }
    listeners.message.forEach((listener) => listener({ data: outgoingMessage }));
  };

  const onDisconnect = () => {
    listeners.close.forEach((listener) => listener());
    cleanup();
  };

  const onError = (error) => {
    listeners.error.forEach((listener) => listener(error));
  };

  socket.on("tldraw-message", onMessage);
  socket.on("disconnect", onDisconnect);
  socket.on("connect_error", onError);

  return {
    get readyState() {
      return socket.connected ? 1 : 3;
    },
    send(message) {
      socket.emit("tldraw-message", message);
    },
    close() {
      cleanup();
      socket.disconnect();
    },
    addEventListener(type, listener) {
      if (listeners[type]) {
        listeners[type].add(listener);
      }
    },
    removeEventListener(type, listener) {
      if (listeners[type]) {
        listeners[type].delete(listener);
      }
    },
  };
}

async function getRoom(workspaceId) {
  const existingRoom = rooms.get(workspaceId);
  if (existingRoom && !existingRoom.isClosed()) {
    return existingRoom;
  }

  if (roomPromises.has(workspaceId)) {
    return roomPromises.get(workspaceId);
  }

  const promise = (async () => {
    const room = new TLSocketRoom({
      schema,
      onSessionRemoved(roomInstance, args) {
        if (args.numSessionsRemaining === 0) {
          roomInstance.close();
          rooms.delete(workspaceId);
        }
      },
    });

    try {
      const events = await eventService.getAllEvents(workspaceId);
      
      if (events && events.length > 0) {
        const dummySocket = {
          readyState: 1,
          send() {},
          close() {},
          addEventListener() {},
          removeEventListener() {},
        };
        
        room.handleSocketConnect({ sessionId: 'hydration', socket: dummySocket });
        
        for (const event of events) {
          if (!event?.payload) continue;

          const isReplayableEventType =
            event.eventType === "tldraw_message" ||
            event.eventType === "tldraw_update";

          if (!isReplayableEventType) continue;

          const replayBuffer = decodeStoredMessageToBuffer(event.payload);
          if (!replayBuffer) continue;

          room.handleSocketMessage("hydration", replayBuffer);
        }
        
        room.handleSocketClose('hydration');
      }
    } catch (e) {
      console.error(`[tldraw-sync] Failed to hydrate room ${workspaceId}`, e);
    }

    rooms.set(workspaceId, room);
    roomPromises.delete(workspaceId);
    return room;
  })();

  roomPromises.set(workspaceId, promise);
  return promise;
}

function createTldrawSyncManager(_io) {
  async function handleWorkspaceJoin(socket) {
    const room = await getRoom(socket.workspaceId);
    room.handleSocketConnect({
      sessionId: socket.id,
      socket: createSocketIoMinimalSocket(socket, room),
      isReadonly: socket.workspaceRole === "viewer",
      meta: {
        userId: socket.user?.id || null,
        workspaceId: socket.workspaceId,
        role: socket.workspaceRole,
      },
    });
  }

  async function cleanupWorkspaceIfUnused(workspaceId) {
    const room = rooms.get(workspaceId);

    if (!room) {
      return;
    }

    if (room.getNumActiveSessions() === 0) {
      room.close();
      rooms.delete(workspaceId);
    }
  }

  function getRoomCount() {
    return rooms.size;
  }

  return {
    handleWorkspaceJoin,
    cleanupWorkspaceIfUnused,
    getRoomCount,
  };
}

module.exports = {
  createTldrawSyncManager,
};
