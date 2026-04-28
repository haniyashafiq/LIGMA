import { createWorkspaceSocket } from '../net/socket.js';

const MOVE_THROTTLE_MS = Math.round(1000 / 15);

function sanitizeString(value) {
  return typeof value === 'string' ? value : '';
}

function sanitizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeNodeType(type) {
  if (type === 'sticky' || type === 'text' || type === 'rectangle' || type === 'ellipse' || type === 'diamond') {
    return type;
  }
  return 'rectangle';
}

function shapeNodePayload(payload = {}) {
  const nodeId = sanitizeString(payload.id || payload.nodeId);
  return {
    nodeId,
    id: nodeId,
    type: normalizeNodeType(payload.type),
    x: sanitizeNumber(payload.x),
    y: sanitizeNumber(payload.y),
    width: sanitizeNumber(payload.width, 240),
    height: sanitizeNumber(payload.height, 180),
    content: sanitizeString(payload.content),
    color: sanitizeString(payload.color || 'default'),
    createdBy: payload.createdBy || null,
    workspaceId: payload.workspaceId || null,
  };
}

function toNodePayload(payload = {}) {
  return shapeNodePayload(payload);
}

function toDeletePayload(payload = {}) {
  const nodeId = sanitizeString(payload.id || payload.nodeId);
  return {
    nodeId,
    id: nodeId,
  };
}

function normalizeIncomingPayload(delta = {}) {
  const payload = delta?.payload && typeof delta.payload === 'object' ? { ...delta.payload } : {};
  if (!payload.id && delta?.nodeId) {
    payload.id = delta.nodeId;
  }
  if (!payload.workspaceId && delta?.workspaceId) {
    payload.workspaceId = delta.workspaceId;
  }
  return payload;
}

export function createSyncBridge({
  workspaceId,
  token,
  nodeManager = null,
  onConnectionStateChange = null,
  onSyncEvent = null,
  onCursorEvent = null,
} = {}) {
  let nodeManagerRef = nodeManager;
  let socketClient = null;
  let detachDelta = null;
  let detachSync = null;
  let detachError = null;
  let detachCursor = null;
  let moveThrottleTimer = null;
  let queuedMovePayload = null;
  let lastMoveSentAt = 0;
  let lastCursorSentAt = 0;
  let queuedCursorPayload = null;
  let cursorThrottleTimer = null;

  function notifySync(event) {
    if (typeof onSyncEvent === 'function') {
      onSyncEvent(event);
    }
  }

  function applyIncomingDelta(delta) {
    if (!nodeManagerRef || !delta?.eventType) {
      return;
    }

    const payload = normalizeIncomingPayload(delta);
    nodeManagerRef.applyRemoteDelta(delta.eventType, payload);
    notifySync({
      direction: 'inbound',
      eventType: delta.eventType,
      payload,
    });
  }

  function handleCanvasSync(syncPayload = {}) {
    const events = Array.isArray(syncPayload.events) ? syncPayload.events : [];
    events.forEach((delta) => {
      applyIncomingDelta(delta);
    });
  }

  function connect() {
    if (!token || !workspaceId) {
      notifySync({
        direction: 'system',
        eventType: 'sync:skipped',
        payload: { reason: 'Missing token or workspaceId.' },
      });
      return false;
    }

    socketClient = createWorkspaceSocket({
      token,
      workspaceId,
      onConnectionStateChange,
    });

    detachDelta = socketClient.on('canvas:delta', (delta) => {
      applyIncomingDelta(delta);
    });

    detachSync = socketClient.on('canvas:sync', (syncPayload) => {
      handleCanvasSync(syncPayload);
      notifySync({
        direction: 'inbound',
        eventType: 'canvas:sync',
        payload: { eventCount: Array.isArray(syncPayload?.events) ? syncPayload.events.length : 0 },
      });
    });

    detachError = socketClient.on('socket:error', (errorPayload = {}) => {
      notifySync({
        direction: 'system',
        eventType: 'socket:error',
        payload: errorPayload,
      });
    });

    detachCursor = socketClient.on('cursor:move', (payload = {}) => {
      if (typeof onCursorEvent === 'function') {
        onCursorEvent(payload);
      }
    });

    return true;
  }

  function emitWithAck(eventName, payload) {
    if (!socketClient) {
      return;
    }

    socketClient.emit(eventName, payload, (ack = {}) => {
      notifySync({
        direction: 'outbound',
        eventType: eventName,
        payload: {
          ok: Boolean(ack.ok),
          code: ack.code || null,
          message: ack.message || null,
          delta: ack.delta || null,
        },
      });
    });
  }

  function flushQueuedMove() {
    if (!queuedMovePayload) {
      moveThrottleTimer = null;
      return;
    }

    const payload = queuedMovePayload;
    queuedMovePayload = null;
    lastMoveSentAt = Date.now();
    emitWithAck('canvas:node:move', payload);
    moveThrottleTimer = null;
  }

  function scheduleMoveEmit(payload) {
    const now = Date.now();
    const elapsed = now - lastMoveSentAt;

    if (elapsed >= MOVE_THROTTLE_MS && !moveThrottleTimer) {
      lastMoveSentAt = now;
      emitWithAck('canvas:node:move', payload);
      return;
    }

    queuedMovePayload = payload;
    if (moveThrottleTimer) {
      return;
    }

    const wait = Math.max(MOVE_THROTTLE_MS - elapsed, 0);
    moveThrottleTimer = window.setTimeout(flushQueuedMove, wait);
  }

  function flushQueuedCursor() {
    if (!queuedCursorPayload) {
      cursorThrottleTimer = null;
      return;
    }

    const payload = queuedCursorPayload;
    queuedCursorPayload = null;
    lastCursorSentAt = Date.now();
    socketClient.emit('cursor:move', payload);
    cursorThrottleTimer = null;
  }

  function emitCursorMove(payload) {
    if (!socketClient) {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastCursorSentAt;
    const threshold = Math.round(1000 / 30);

    if (elapsed >= threshold && !cursorThrottleTimer) {
      lastCursorSentAt = now;
      socketClient.emit('cursor:move', payload);
      return;
    }

    queuedCursorPayload = payload;
    if (cursorThrottleTimer) {
      return;
    }

    cursorThrottleTimer = window.setTimeout(flushQueuedCursor, Math.max(threshold - elapsed, 0));
  }

  function handleLocalNodeEvent(eventType, payload = {}) {
    if (!socketClient) {
      return;
    }

    if (eventType === 'canvas:node:delete') {
      emitWithAck(eventType, toDeletePayload(payload));
      return;
    }

    if (eventType === 'canvas:node:move') {
      scheduleMoveEmit(toNodePayload(payload.serialized || payload));
      return;
    }

    emitWithAck(eventType, toNodePayload(payload.serialized || payload));
  }

  function disconnect() {
    if (moveThrottleTimer) {
      window.clearTimeout(moveThrottleTimer);
    }
    if (cursorThrottleTimer) {
      window.clearTimeout(cursorThrottleTimer);
    }
    moveThrottleTimer = null;
    cursorThrottleTimer = null;
    queuedMovePayload = null;
    queuedCursorPayload = null;

    if (typeof detachDelta === 'function') {
      detachDelta();
    }
    if (typeof detachSync === 'function') {
      detachSync();
    }
    if (typeof detachError === 'function') {
      detachError();
    }
    if (typeof detachCursor === 'function') {
      detachCursor();
    }

    detachDelta = null;
    detachSync = null;
    detachError = null;
    detachCursor = null;

    if (socketClient) {
      socketClient.disconnect();
      socketClient = null;
    }
  }

  return {
    bindNodeManager(nextNodeManager) {
      nodeManagerRef = nextNodeManager || null;
    },
    connect,
    disconnect,
    handleLocalNodeEvent,
    emitCursorMove,
    getSocketClient() {
      return socketClient;
    },
    getConnectionState() {
      return socketClient?.getConnectionState?.() || 'disconnected';
    },
  };
}
