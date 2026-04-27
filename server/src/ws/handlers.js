const { appendEvent, getEventsSince } = require('../services/event.service');
const { checkNodePermission } = require('../middleware/rbac');

const CANVAS_EVENT_ACTION_MAP = {
  'canvas:node:create': 'create',
  'canvas:node:update': 'edit',
  'canvas:node:move': 'move',
  'canvas:node:delete': 'delete',
  'canvas:draw:stroke': 'create',
  'canvas:draw:erase': 'delete',
};

function createSocketError(message, code = 'BAD_REQUEST') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getRoom(workspaceId) {
  return `room:${workspaceId}`;
}

function requireObjectPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createSocketError('Payload must be an object.');
  }

  return payload;
}

function getNodeId(payload) {
  if (typeof payload.nodeId === 'string' && payload.nodeId.trim().length > 0) {
    return payload.nodeId.trim();
  }

  return null;
}

async function enforceCanvasPermission(socket, eventName, payload) {
  const action = CANVAS_EVENT_ACTION_MAP[eventName];
  const nodeId = getNodeId(payload);
  const isAllowed = await checkNodePermission(
    action,
    nodeId,
    socket.user.id,
    socket.workspaceId
  );

  if (!isAllowed) {
    throw createSocketError('Permission denied for this action.', 'FORBIDDEN');
  }

  return nodeId;
}

async function persistAndBroadcastCanvasDelta(io, socket, eventName, payload) {
  const validPayload = requireObjectPayload(payload);
  const nodeId = await enforceCanvasPermission(socket, eventName, validPayload);

  const persisted = await appendEvent(
    socket.workspaceId,
    socket.user.id,
    eventName,
    nodeId,
    validPayload,
    null
  );

  const room = getRoom(socket.workspaceId);
  const delta = {
    id: persisted.id,
    sequenceNum: persisted.sequence_num,
    workspaceId: socket.workspaceId,
    userId: socket.user.id,
    eventType: eventName,
    nodeId,
    payload: validPayload,
    createdAt: new Date().toISOString(),
  };

  io.to(room).emit('canvas:delta', delta);
  return delta;
}

function registerCanvasMutationHandler(io, socket, eventName) {
  socket.on(eventName, async (payload = {}, ack) => {
    try {
      const delta = await persistAndBroadcastCanvasDelta(io, socket, eventName, payload);
      if (typeof ack === 'function') {
        ack({ ok: true, delta });
      }
    } catch (error) {
      if (typeof ack === 'function') {
        ack({ ok: false, message: error.message, code: error.code || 'INTERNAL_ERROR' });
      } else {
        socket.emit('socket:error', { message: error.message, code: error.code || 'INTERNAL_ERROR' });
      }
    }
  });
}

function registerCursorMoveHandler(io, socket) {
  socket.on('cursor:move', (payload = {}, ack) => {
    const room = getRoom(socket.workspaceId);

    if (!payload || typeof payload !== 'object') {
      if (typeof ack === 'function') {
        ack({ ok: false, message: 'Payload must be an object.', code: 'BAD_REQUEST' });
      }
      return;
    }

    socket.to(room).emit('cursor:move', {
      userId: socket.user.id,
      workspaceId: socket.workspaceId,
      payload,
    });

    if (typeof ack === 'function') {
      ack({ ok: true });
    }
  });
}

function registerReconnectHandler(socket) {
  socket.on('reconnect', async (payload = {}, ack) => {
    try {
      const sinceSequence = Number(payload?.lastSequenceNum) || 0;
      const events = await getEventsSince(socket.workspaceId, sinceSequence);

      const syncPayload = {
        workspaceId: socket.workspaceId,
        fromSequence: sinceSequence,
        events,
      };

      socket.emit('canvas:sync', syncPayload);

      if (typeof ack === 'function') {
        ack({ ok: true, eventCount: events.length });
      }
    } catch (error) {
      if (typeof ack === 'function') {
        ack({ ok: false, message: error.message, code: 'INTERNAL_ERROR' });
      } else {
        socket.emit('socket:error', { message: 'Failed to sync missed events.', code: 'INTERNAL_ERROR' });
      }
    }
  });
}

function registerAwarenessHandler(io, socket) {
  socket.on('awareness:update', (payload = {}, ack) => {
    if (!payload || typeof payload !== 'object' || typeof payload.update !== 'string') {
      if (typeof ack === 'function') {
        ack({ ok: false, message: 'Invalid awareness payload.', code: 'BAD_REQUEST' });
      }
      return;
    }

    socket.to(getRoom(socket.workspaceId)).emit('awareness:update', {
      workspaceId: socket.workspaceId,
      userId: socket.user.id,
      update: payload.update,
      senderSocketId: socket.id,
    });

    if (typeof ack === 'function') {
      ack({ ok: true });
    }
  });
}

function registerSocketHandlers(io, socket, { yjsSyncManager } = {}) {
  const canvasEvents = Object.keys(CANVAS_EVENT_ACTION_MAP);
  canvasEvents.forEach((eventName) => {
    registerCanvasMutationHandler(io, socket, eventName);
  });

  if (yjsSyncManager) {
    socket.on('yjs:update', (payload = {}, ack) => {
      yjsSyncManager.handleYjsUpdate(socket, payload, ack);
    });
  }

  registerCursorMoveHandler(io, socket);
  registerAwarenessHandler(io, socket);
  registerReconnectHandler(socket);
}

module.exports = {
  registerSocketHandlers,
};
