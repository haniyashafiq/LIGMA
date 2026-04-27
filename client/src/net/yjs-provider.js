import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';

function toBase64(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i += 1) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return window.btoa(binary);
}

function fromBase64(base64String) {
  const binary = window.atob(base64String);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function createYjsProvider({ socketClient, doc = new Y.Doc(), awarenessUser } = {}) {
  if (!socketClient?.socket) {
    throw new Error('socketClient with a connected socket is required.');
  }

  const awareness = new Awareness(doc);
  const socket = socketClient.socket;
  let isApplyingRemoteUpdate = false;

  const onDocUpdate = (update, origin) => {
    if (origin === 'remote' || isApplyingRemoteUpdate) {
      return;
    }

    socket.emit('yjs:update', {
      update: toBase64(update),
    });
  };

  doc.on('update', onDocUpdate);

  const yjsSyncHandler = (payload = {}) => {
    if (typeof payload.update !== 'string') {
      return;
    }

    isApplyingRemoteUpdate = true;
    try {
      Y.applyUpdate(doc, fromBase64(payload.update), 'remote');
    } finally {
      isApplyingRemoteUpdate = false;
    }
  };

  const yjsUpdateHandler = (payload = {}) => {
    if (payload.senderSocketId === socket.id || typeof payload.update !== 'string') {
      return;
    }

    isApplyingRemoteUpdate = true;
    try {
      Y.applyUpdate(doc, fromBase64(payload.update), 'remote');
    } finally {
      isApplyingRemoteUpdate = false;
    }
  };

  const awarenessUpdateHandler = (payload = {}) => {
    if (payload.senderSocketId === socket.id || typeof payload.update !== 'string') {
      return;
    }

    applyAwarenessUpdate(awareness, fromBase64(payload.update), 'remote');
  };

  socket.on('yjs:sync', yjsSyncHandler);
  socket.on('yjs:update', yjsUpdateHandler);
  socket.on('awareness:update', awarenessUpdateHandler);

  awareness.setLocalStateField('user', awarenessUser || null);
  awareness.on('update', ({ added, updated, removed }, origin) => {
    if (origin === 'remote') {
      return;
    }

    const changedClients = [...added, ...updated, ...removed];
    if (changedClients.length === 0) {
      return;
    }

    const encoded = encodeAwarenessUpdate(awareness, changedClients);
    socket.emit('awareness:update', {
      update: toBase64(encoded),
    });
  });

  return {
    doc,
    awareness,
    setLocalAwarenessState(nextState) {
      awareness.setLocalStateField('user', nextState);
    },
    destroy() {
      doc.off('update', onDocUpdate);
      socket.off('yjs:sync', yjsSyncHandler);
      socket.off('yjs:update', yjsUpdateHandler);
      socket.off('awareness:update', awarenessUpdateHandler);
      awareness.destroy();
      doc.destroy();
    },
  };
}
