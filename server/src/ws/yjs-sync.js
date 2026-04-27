const Y = require('yjs');
const {
  appendEvent,
  createSnapshot,
  getEventsSince,
  getLatestSnapshot,
} = require('../services/event.service');

const SNAPSHOT_UPDATE_THRESHOLD = 50;
const SNAPSHOT_INTERVAL_MS = 60 * 1000;

function decodeBase64Update(updateBase64) {
  if (typeof updateBase64 !== 'string' || updateBase64.length === 0) {
    throw new Error('Invalid Yjs update payload.');
  }

  return Buffer.from(updateBase64, 'base64');
}

function encodeBase64Update(updateBuffer) {
  return Buffer.from(updateBuffer).toString('base64');
}

function createYjsSyncManager(io) {
  const workspaceDocs = new Map();

  async function hydrateDocFromPersistence(workspaceId, docState) {
    const snapshot = await getLatestSnapshot(workspaceId);
    let fromSequence = 0;

    if (snapshot?.snapshot) {
      Y.applyUpdate(docState.doc, new Uint8Array(snapshot.snapshot), 'hydrate:snapshot');
      fromSequence = Number(snapshot.lastSequenceNum) || 0;
    }

    const events = await getEventsSince(workspaceId, fromSequence);
    events.forEach((event) => {
      if (event.eventType === 'yjs:update' && event.yjsUpdate) {
        Y.applyUpdate(docState.doc, new Uint8Array(event.yjsUpdate), 'hydrate:event');
      }
    });

    docState.lastSequenceNum = events.length
      ? events[events.length - 1].sequenceNum
      : fromSequence;
  }

  async function ensureWorkspaceDoc(workspaceId) {
    if (workspaceDocs.has(workspaceId)) {
      return workspaceDocs.get(workspaceId);
    }

    const docState = {
      doc: new Y.Doc(),
      updateCountSinceSnapshot: 0,
      lastSequenceNum: 0,
      snapshotTimer: null,
      hydrationPromise: null,
    };

    docState.hydrationPromise = (async () => {
      await hydrateDocFromPersistence(workspaceId, docState);
      return docState;
    })();

    docState.snapshotTimer = setInterval(async () => {
      if (docState.updateCountSinceSnapshot === 0) {
        return;
      }

      try {
        const snapshotBytes = Y.encodeStateAsUpdate(docState.doc);
        await createSnapshot(workspaceId, Buffer.from(snapshotBytes), docState.lastSequenceNum);
        docState.updateCountSinceSnapshot = 0;
      } catch (_error) {
        // Best-effort snapshotting should not break live collaboration.
      }
    }, SNAPSHOT_INTERVAL_MS);

    workspaceDocs.set(workspaceId, docState);
    await docState.hydrationPromise;
    return docState;
  }

  async function createThresholdSnapshot(workspaceId, docState) {
    const snapshotBytes = Y.encodeStateAsUpdate(docState.doc);
    await createSnapshot(workspaceId, Buffer.from(snapshotBytes), docState.lastSequenceNum);
    docState.updateCountSinceSnapshot = 0;
  }

  async function handleYjsUpdate(socket, payload = {}, ack) {
    try {
      const workspaceId = socket.workspaceId;
      const room = `room:${workspaceId}`;
      const docState = await ensureWorkspaceDoc(workspaceId);
      const updateBuffer = decodeBase64Update(payload.update);

      Y.applyUpdate(docState.doc, new Uint8Array(updateBuffer), 'socket:update');

      const persisted = await appendEvent(
        workspaceId,
        socket.user.id,
        'yjs:update',
        null,
        { source: 'socket' },
        updateBuffer
      );

      docState.lastSequenceNum = persisted.sequence_num;
      docState.updateCountSinceSnapshot += 1;

      if (docState.updateCountSinceSnapshot >= SNAPSHOT_UPDATE_THRESHOLD) {
        await createThresholdSnapshot(workspaceId, docState);
      }

      io.to(room).emit('yjs:update', {
        workspaceId,
        update: encodeBase64Update(updateBuffer),
        sequenceNum: persisted.sequence_num,
        senderSocketId: socket.id,
      });

      if (typeof ack === 'function') {
        ack({ ok: true, sequenceNum: persisted.sequence_num });
      }
    } catch (error) {
      if (typeof ack === 'function') {
        ack({ ok: false, message: error.message, code: 'YJS_UPDATE_FAILED' });
      } else {
        socket.emit('socket:error', { message: error.message, code: 'YJS_UPDATE_FAILED' });
      }
    }
  }

  async function handleWorkspaceJoin(socket) {
    const docState = await ensureWorkspaceDoc(socket.workspaceId);
    const fullUpdate = Y.encodeStateAsUpdate(docState.doc);

    socket.emit('yjs:sync', {
      workspaceId: socket.workspaceId,
      update: encodeBase64Update(fullUpdate),
      lastSequenceNum: docState.lastSequenceNum,
    });
  }

  async function cleanupWorkspaceIfUnused(workspaceId) {
    const room = `room:${workspaceId}`;
    const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;

    if (roomSize > 0) {
      return;
    }

    const docState = workspaceDocs.get(workspaceId);
    if (!docState) {
      return;
    }

    if (docState.updateCountSinceSnapshot > 0) {
      try {
        const snapshotBytes = Y.encodeStateAsUpdate(docState.doc);
        await createSnapshot(workspaceId, Buffer.from(snapshotBytes), docState.lastSequenceNum);
      } catch (_error) {
        // Keep cleanup resilient.
      }
    }

    if (docState.snapshotTimer) {
      clearInterval(docState.snapshotTimer);
    }

    docState.doc.destroy();
    workspaceDocs.delete(workspaceId);
  }

  function getWorkspaceDocCount() {
    return workspaceDocs.size;
  }

  return {
    ensureWorkspaceDoc,
    handleWorkspaceJoin,
    handleYjsUpdate,
    cleanupWorkspaceIfUnused,
    getWorkspaceDocCount,
  };
}

module.exports = {
  createYjsSyncManager,
};
