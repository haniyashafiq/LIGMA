const Y = require("yjs");
const eventService = require("../services/event.service");
const taskService = require("../services/task.service");
const { getUserWorkspaceRole } = require("../middleware/rbac");
const { classifyIntentForNode } = require("../services/intent.service");
const {
  applySemanticEvent,
  applyTextDelta,
  ensureNodeText,
  getMeta,
  getNodeText,
  getNodeTextsMap,
  getNodeWithText,
  getNodesMap,
} = require("../services/canvas-event-projector");

const rooms = new Map();
const roomPromises = new Map();
const SNAPSHOT_EVERY_EVENTS = 50;

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getNodeOwnerId(node) {
  const metadata = getMeta(node);
  return metadata.authorId || metadata.ownerId || metadata.createdBy || null;
}

function normalizeNodeId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeText(value) {
  return typeof value === "string" ? value : "";
}

function sanitizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeStyle(style) {
  if (!style || typeof style !== "object") {
    return {};
  }

  return {
    fill: typeof style.fill === "string" ? style.fill : undefined,
    stroke: typeof style.stroke === "string" ? style.stroke : undefined,
    strokeWidth: sanitizeNumber(style.strokeWidth, 2),
    fontSize: sanitizeNumber(style.fontSize, 18),
  };
}

function sanitizeNode(input, user, role) {
  if (!input || typeof input !== "object") {
    throw createHttpError("Canvas node payload is required.");
  }

  const id = normalizeNodeId(input.id);
  if (!id) {
    throw createHttpError("Canvas node id is required.");
  }

  const now = new Date().toISOString();
  const metadata = getMeta(input);

  return {
    id,
    type: typeof input.type === "string" ? input.type : "note",
    x: sanitizeNumber(input.x),
    y: sanitizeNumber(input.y),
    width: sanitizeNumber(input.width, 180),
    height: sanitizeNumber(input.height, 90),
    rotation: sanitizeNumber(input.rotation),
    zIndex: sanitizeNumber(input.zIndex),
    text: sanitizeText(input.text),
    points: Array.isArray(input.points) ? input.points.map((n) => sanitizeNumber(n)) : [],
    style: sanitizeStyle(input.style),
    metadata: {
      ...metadata,
      authorId: user.id,
      authorName: user.username,
      ownerId: user.id,
      createdAt: metadata.createdAt || now,
      updatedAt: now,
      lockedBy: role === "lead" ? metadata.lockedBy || null : null,
      permissions:
        role === "lead" && metadata.permissions && typeof metadata.permissions === "object"
          ? metadata.permissions
          : {},
    },
  };
}

function sanitizePatch(patch, currentNode, user, role) {
  if (!patch || typeof patch !== "object") {
    throw createHttpError("Canvas patch payload is required.");
  }

  const next = {
    ...currentNode,
    ...patch,
    id: currentNode.id,
    metadata: {
      ...getMeta(currentNode),
      ...(role === "lead" && patch.metadata && typeof patch.metadata === "object"
        ? patch.metadata
        : {}),
      updatedAt: new Date().toISOString(),
    },
  };

  if (patch.style) next.style = sanitizeStyle({ ...currentNode.style, ...patch.style });
  if (patch.points) next.points = Array.isArray(patch.points) ? patch.points.map((n) => sanitizeNumber(n)) : [];
  if (patch.type !== undefined) next.type = typeof patch.type === "string" ? patch.type : currentNode.type;
  if (patch.x !== undefined) next.x = sanitizeNumber(patch.x, currentNode.x);
  if (patch.y !== undefined) next.y = sanitizeNumber(patch.y, currentNode.y);
  if (patch.width !== undefined) next.width = sanitizeNumber(patch.width, currentNode.width);
  if (patch.height !== undefined) next.height = sanitizeNumber(patch.height, currentNode.height);
  if (patch.rotation !== undefined) next.rotation = sanitizeNumber(patch.rotation, currentNode.rotation);
  if (patch.zIndex !== undefined) next.zIndex = sanitizeNumber(patch.zIndex, currentNode.zIndex);

  if (role !== "lead") {
    next.metadata.authorId = getMeta(currentNode).authorId;
    next.metadata.authorName = getMeta(currentNode).authorName;
    next.metadata.ownerId = getMeta(currentNode).ownerId;
    next.metadata.lockedBy = getMeta(currentNode).lockedBy || null;
    next.metadata.permissions = getMeta(currentNode).permissions || {};
  }

  return next;
}

function sanitizeTextDelta(delta) {
  if (!delta || typeof delta !== "object") {
    throw createHttpError("Canvas text delta payload is required.");
  }

  return {
    index: Math.max(0, sanitizeNumber(delta.index)),
    delete: Math.max(0, sanitizeNumber(delta.delete)),
    insert: typeof delta.insert === "string" ? delta.insert : "",
  };
}

function isTextBearingNode(node) {
  return Boolean(node && typeof node.text === "string" && node.text.trim());
}

function hasExplicitEditorPermission(node, userId) {
  const permissions = getMeta(node).permissions;
  if (!permissions || typeof permissions !== "object") return false;
  const editors = Array.isArray(permissions.editors) ? permissions.editors : [];
  return editors.map(String).includes(String(userId));
}

async function assertCanMutate({ action, node, user, workspaceId }) {
  const role = await getUserWorkspaceRole(workspaceId, user.id);
  if (!role) {
    throw createHttpError("Workspace access denied.", 403);
  }

  if (role === "viewer") {
    throw createHttpError("View-only access: you can't edit this workspace.", 403);
  }

  if (role === "lead") {
    return role;
  }

  if (action === "create") {
    return role;
  }

  if (!node) {
    throw createHttpError("Canvas node not found.", 404);
  }

  const metadata = getMeta(node);
  if (metadata.lockedBy) {
    throw createHttpError("This canvas node is locked by a workspace lead.", 403);
  }

  const ownerId = getNodeOwnerId(node);
  if (ownerId && String(ownerId) === String(user.id)) {
    return role;
  }

  if (action === "update" && hasExplicitEditorPermission(node, user.id)) {
    return role;
  }

  throw createHttpError("Contributors can only modify their own unlocked canvas nodes.", 403);
}

function eventTypeForOp(type) {
  switch (type) {
    case "node:create":
      return "canvas:node:create";
    case "node:update":
      return "canvas:node:update";
    case "node:text:delta":
      return "canvas:node:text:delta";
    case "node:delete":
      return "canvas:node:delete";
    case "node:lock":
      return "canvas:node:lock";
    case "node:unlock":
      return "canvas:node:unlock";
    case "node:permission:update":
      return "canvas:node:permission:update";
    default:
      throw createHttpError("Unsupported canvas operation.");
  }
}

function shouldClassifyAfterOp(type) {
  return type === "node:create" || type === "node:update" || type === "node:text:delta";
}

function applyOperationToDoc(doc, op, socket, role) {
  const nodes = getNodesMap(doc);
  const type = typeof op?.type === "string" ? op.type : "";
  const nodeId = normalizeNodeId(op?.nodeId || op?.node?.id);

  if (type === "node:create") {
    const node = sanitizeNode({ ...op.node, id: op.node?.id || nodeId }, socket.user, role);
    nodes.set(node.id, node);
    ensureNodeText(doc, node.id, node.text);
    return { nodeId: node.id, payload: { opId: op.opId || null, node }, changedNode: node };
  }

  if (!nodeId) {
    throw createHttpError("Canvas node id is required.");
  }

  const currentNode = nodes.get(nodeId);

  if (type === "node:update") {
    if (!currentNode) throw createHttpError("Canvas node not found.", 404);
    if (op.patch?.text !== undefined || op.node?.text !== undefined) {
      throw createHttpError("Text edits must use node:text:delta so concurrent typing can merge.", 400);
    }
    const node = sanitizePatch(op.patch || op.node || {}, currentNode, socket.user, role);
    nodes.set(nodeId, node);
    return { nodeId, payload: { opId: op.opId || null, node }, changedNode: getNodeWithText(doc, nodeId) || node };
  }

  if (type === "node:text:delta") {
    if (!currentNode) throw createHttpError("Canvas node not found.", 404);
    if (currentNode.type !== "text" && currentNode.type !== "note") {
      throw createHttpError("Only text-bearing nodes can receive text deltas.", 400);
    }
    const delta = sanitizeTextDelta(op.delta);
    applyTextDelta(doc, nodeId, delta);
    const changedNode = getNodeWithText(doc, nodeId) || {
      ...currentNode,
      text: getNodeText(doc, nodeId, currentNode.text),
    };
    return { nodeId, payload: { opId: op.opId || null, nodeId, delta }, changedNode };
  }

  if (type === "node:delete") {
    nodes.delete(nodeId);
    getNodeTextsMap(doc).delete(nodeId);
    return { nodeId, payload: { opId: op.opId || null, nodeId }, changedNode: currentNode || null };
  }

  if (type === "node:lock") {
    if (!currentNode) throw createHttpError("Canvas node not found.", 404);
    const node = { ...currentNode, metadata: { ...getMeta(currentNode), lockedBy: socket.user.id } };
    nodes.set(nodeId, node);
    return { nodeId, payload: { opId: op.opId || null, nodeId, lockedBy: socket.user.id }, changedNode: node };
  }

  if (type === "node:unlock") {
    if (!currentNode) throw createHttpError("Canvas node not found.", 404);
    const node = { ...currentNode, metadata: { ...getMeta(currentNode), lockedBy: null } };
    nodes.set(nodeId, node);
    return { nodeId, payload: { opId: op.opId || null, nodeId }, changedNode: node };
  }

  if (type === "node:permission:update") {
    if (!currentNode) throw createHttpError("Canvas node not found.", 404);
    const permissions = op.permissions && typeof op.permissions === "object" ? op.permissions : {};
    const node = { ...currentNode, metadata: { ...getMeta(currentNode), permissions } };
    nodes.set(nodeId, node);
    return { nodeId, payload: { opId: op.opId || null, nodeId, permissions }, changedNode: node };
  }

  throw createHttpError("Unsupported canvas operation.");
}

async function maybeClassifyNode({ room, io, workspaceId, userId, node }) {
  if (!isTextBearingNode(node)) return;

  const classification = classifyIntentForNode(node.text, node.type);
  const metadata = { ...getMeta(node), intent: classification.intent };
  const classifiedNode = { ...node, metadata };

  let update = null;
  const onUpdate = (nextUpdate) => {
    update = Buffer.from(nextUpdate);
  };

  room.doc.on("update", onUpdate);
  room.doc.transact(() => {
    getNodesMap(room.doc).set(node.id, classifiedNode);
  }, "intent-classifier");
  room.doc.off("update", onUpdate);

  const event = await eventService.appendEvent(
    workspaceId,
    userId,
    "canvas:intent:classified",
    node.id,
    {
      nodeId: node.id,
      intent: classification.intent,
      confidence: classification.confidence,
      reason: classification.reason,
      node: classifiedNode,
    },
    update,
  );

  room.lastSequenceNum = Number(event.sequence_num);

  io.to(`room:${workspaceId}`).emit("canvas:delta", {
    sequenceNum: room.lastSequenceNum,
    eventType: "canvas:intent:classified",
    nodeId: node.id,
    update,
  });

  if (classification.intent === "action_item") {
    const task = await taskService.upsertTaskByNodeId(workspaceId, node.id, {
      title: node.text.trim(),
      status: "todo",
      priority: "medium",
      assigneeId: null,
      source: "ai",
      intent: classification.intent,
      sourceAuthorId: metadata.authorId || userId || null,
      sourceAuthorName: metadata.authorName || null,
    });

    const payload = {
      id: task.id,
      title: task.title,
      status: task.status,
      sourceNodeId: task.source_node_id,
      source_node_id: task.source_node_id,
      authorName: task.authorName || task.source_author_name || null,
    };

    io.to(`room:${workspaceId}`).emit("task:sync", payload);
  } else {
    const deletedRows = await taskService.deleteTaskByNodeId(workspaceId, node.id);
    if (deletedRows.length > 0) {
      io.to(`room:${workspaceId}`).emit("task:sync", {
        deleted: true,
        sourceNodeId: node.id,
        preserveNode: true,
      });
    }
  }
}

async function getRoom(workspaceId) {
  const existing = rooms.get(workspaceId);
  if (existing) return existing;

  if (roomPromises.has(workspaceId)) {
    return roomPromises.get(workspaceId);
  }

  const promise = (async () => {
    const doc = new Y.Doc();
    let lastSequenceNum = 0;

    const snapshot = await eventService.getLatestSnapshot(workspaceId).catch(() => null);
    if (snapshot?.snapshot) {
      Y.applyUpdate(doc, new Uint8Array(snapshot.snapshot));
      lastSequenceNum = Number(snapshot.lastSequenceNum) || 0;
    }

    const events = await eventService.getEventsSince(workspaceId, lastSequenceNum);
    for (const event of events) {
      if (event.yjsUpdate) {
        Y.applyUpdate(doc, new Uint8Array(event.yjsUpdate));
      } else {
        doc.transact(() => applySemanticEvent(doc, event), "event-replay");
      }
      lastSequenceNum = Number(event.sequenceNum) || lastSequenceNum;
    }

    const room = { doc, workspaceId, lastSequenceNum, opQueue: Promise.resolve() };
    rooms.set(workspaceId, room);
    roomPromises.delete(workspaceId);
    return room;
  })();

  roomPromises.set(workspaceId, promise);
  return promise;
}

async function sendRecovery(socket, room, sinceSequence = 0) {
  const since = Number(sinceSequence) || 0;
  if (since <= 0) {
    socket.emit("canvas:delta", {
      sequenceNum: room.lastSequenceNum,
      eventType: "canvas:snapshot",
      update: Buffer.from(Y.encodeStateAsUpdate(room.doc)),
      snapshot: true,
    });
    return;
  }

  const missed = await eventService.getEventsSince(room.workspaceId, since);
  if (missed.length === 0) {
    socket.emit("canvas:delta", {
      sequenceNum: room.lastSequenceNum,
      eventType: "canvas:snapshot",
      update: Buffer.from(Y.encodeStateAsUpdate(room.doc)),
      snapshot: true,
    });
    return;
  }

  for (const event of missed) {
    if (event.yjsUpdate) {
      socket.emit("canvas:delta", {
        sequenceNum: event.sequenceNum,
        eventType: event.eventType,
        nodeId: event.nodeId,
        update: event.yjsUpdate,
        replay: true,
      });
      continue;
    }

    // Semantic-only events depend on existing document state. Fall back to the
    // authoritative room snapshot rather than letting incremental recovery drift.
    socket.emit("canvas:delta", {
      sequenceNum: room.lastSequenceNum,
      eventType: "canvas:snapshot",
      update: Buffer.from(Y.encodeStateAsUpdate(room.doc)),
      snapshot: true,
    });
    return;
  }
}

function createCanvasSyncManager(io) {
  async function handleWorkspaceJoin(socket) {
    const room = await getRoom(socket.workspaceId);
    const workspaceRoom = `room:${socket.workspaceId}`;

    socket.on("canvas:hello", async (payload = {}) => {
      await sendRecovery(socket, room, payload.lastSequenceNum);
    });

    socket.on("canvas:op", (op = {}) => {
      room.opQueue = room.opQueue
        .catch((error) => {
          console.error("[canvas-sync] Previous canvas operation failed", error);
        })
        .then(async () => {
      let update = null;
      const type = typeof op?.type === "string" ? op.type : "";
      const nodes = getNodesMap(room.doc);
      const nodeId = normalizeNodeId(op.nodeId || op.node?.id);
      const currentNode = nodeId ? nodes.get(nodeId) : null;

      try {
        const action =
          type === "node:create"
            ? "create"
            : type === "node:delete"
              ? "delete"
              : "update";
        const role = await assertCanMutate({
          action,
          node: currentNode,
          user: socket.user,
          workspaceId: socket.workspaceId,
        });

        if ((type === "node:lock" || type === "node:unlock" || type === "node:permission:update") && role !== "lead") {
          throw createHttpError("Only workspace leads can change node locks or permissions.", 403);
        }

        const onUpdate = (nextUpdate) => {
          update = Buffer.from(nextUpdate);
        };
        room.doc.on("update", onUpdate);

        let result;
        room.doc.transact(() => {
          result = applyOperationToDoc(room.doc, op, socket, role);
        }, socket.id);
        room.doc.off("update", onUpdate);

        if (!update) {
          socket.emit("canvas:ack", { opId: op.opId || null, sequenceNum: room.lastSequenceNum });
          return;
        }

        const event = await eventService.appendEvent(
          socket.workspaceId,
          socket.user?.id || null,
          eventTypeForOp(type),
          result.nodeId,
          result.payload,
          update,
        );
        room.lastSequenceNum = Number(event.sequence_num);

        io.to(workspaceRoom).emit("canvas:delta", {
          opId: op.opId || null,
          sequenceNum: room.lastSequenceNum,
          eventType: eventTypeForOp(type),
          nodeId: result.nodeId,
          update,
        });

        // ── Task Deletion Sync ──────────────────────────────────────────
        if (type === "node:delete") {
          try {
            await taskService.deleteTaskByNodeId(socket.workspaceId, nodeId);
            io.to(workspaceRoom).emit("task:sync", { deleted: true, sourceNodeId: nodeId });
          } catch (err) {
            console.error("[canvas-sync] Failed to delete linked task", err);
          }
        }

        if (shouldClassifyAfterOp(type)) {
          try {
            await maybeClassifyNode({
              room,
              io,
              workspaceId: socket.workspaceId,
              userId: socket.user?.id || null,
              node: result.changedNode,
            });
          } catch (error) {
            console.error("[canvas-sync] Intent extraction failed", error);
          }
        }

        if (room.lastSequenceNum > 0 && room.lastSequenceNum % SNAPSHOT_EVERY_EVENTS === 0) {
          eventService
            .createSnapshot(socket.workspaceId, Buffer.from(Y.encodeStateAsUpdate(room.doc)), room.lastSequenceNum)
            .catch((error) => console.error("[canvas-sync] Snapshot failed", error));
        }
      } catch (error) {
        socket.emit("canvas:rejected", {
          opId: op?.opId || null,
          message: error.message || "Canvas operation rejected.",
          statusCode: error.statusCode || 400,
        });
        socket.emit("workspace:rbac_denied", {
          message: error.message || "Canvas operation rejected.",
        });
      }
        });
    });
  }

  async function cleanupWorkspaceIfUnused(workspaceId) {
    const roomName = `room:${workspaceId}`;
    const sockets = await io.in(roomName).fetchSockets().catch(() => []);
    if (sockets.length === 0) {
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
  createCanvasSyncManager,
};
