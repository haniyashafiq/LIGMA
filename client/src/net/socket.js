import { io } from 'socket.io-client';

const LAST_SEQUENCE_STORAGE_KEY = 'ligma:lastSequenceNum';

export const CONNECTION_STATES = {
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
};

function readLastSequenceNum() {
  const raw = window.sessionStorage.getItem(LAST_SEQUENCE_STORAGE_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeLastSequenceNum(sequenceNum) {
  const normalized = Number(sequenceNum);
  if (Number.isFinite(normalized) && normalized >= 0) {
    window.sessionStorage.setItem(LAST_SEQUENCE_STORAGE_KEY, String(normalized));
  }
}

export function createWorkspaceSocket({ token, workspaceId, onConnectionStateChange } = {}) {
  if (!token) {
    throw new Error('Socket token is required.');
  }

  if (!workspaceId) {
    throw new Error('workspaceId is required for socket connection.');
  }

  let connectionState = CONNECTION_STATES.DISCONNECTED;

  const socket = io('/', {
    transports: ['websocket'],
    autoConnect: true,
    auth: {
      token,
      workspaceId,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
  });

  function setState(nextState) {
    connectionState = nextState;
    if (typeof onConnectionStateChange === 'function') {
      onConnectionStateChange(nextState);
    }
  }

  socket.on('connect', () => {
    setState(CONNECTION_STATES.CONNECTED);

    socket.emit('reconnect', {
      lastSequenceNum: readLastSequenceNum(),
    });
  });

  socket.on('disconnect', () => {
    setState(CONNECTION_STATES.DISCONNECTED);
  });

  socket.on('reconnect_attempt', () => {
    setState(CONNECTION_STATES.RECONNECTING);
  });

  socket.on('canvas:delta', (delta) => {
    if (delta?.sequenceNum != null) {
      writeLastSequenceNum(delta.sequenceNum);
    }
  });

  socket.on('yjs:update', (payload) => {
    if (payload?.sequenceNum != null) {
      writeLastSequenceNum(payload.sequenceNum);
    }
  });

  socket.on('canvas:sync', (payload) => {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    const maxSequence = events.reduce((max, event) => {
      const current = Number(event?.sequenceNum);
      return Number.isFinite(current) && current > max ? current : max;
    }, readLastSequenceNum());

    writeLastSequenceNum(maxSequence);
  });

  return {
    socket,
    emit(eventName, payload, ack) {
      socket.emit(eventName, payload, ack);
    },
    on(eventName, handler) {
      socket.on(eventName, handler);
      return () => socket.off(eventName, handler);
    },
    off(eventName, handler) {
      socket.off(eventName, handler);
    },
    disconnect() {
      socket.disconnect();
    },
    getConnectionState() {
      return connectionState;
    },
  };
}
