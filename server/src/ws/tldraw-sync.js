const { createTLSchema, defaultShapeSchemas } = require("@tldraw/tlschema");
const { TLSocketRoom } = require("@tldraw/sync-core");
const eventService = require("../services/event.service");

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

function createSocketIoMinimalSocket(socket) {
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
    try {
      const parsed = typeof message === "string" ? JSON.parse(message) : message;
      // Persist any message that isn't a heartbeat or status check
      if (parsed.type && !["ping", "pong", "presence"].includes(parsed.type)) {
        await eventService.appendEvent(
          socket.workspaceId,
          socket.user?.id || null,
          "tldraw_update",
          null,
          parsed
        );
      }
    } catch (e) {
      console.error("[tldraw-sync] Failed to persist update", e);
    }
    
    // Ensure data is Uint8Array for tldraw core
    const data = new TextEncoder().encode(typeof message === "string" ? message : JSON.stringify(message));
    listeners.message.forEach((listener) => listener({ data }));
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
        console.log(`[tldraw-sync] Hydrating room ${workspaceId} with ${events.length} events`);
        const dummySocket = {
          readyState: 1,
          send() {},
          close() {},
          addEventListener() {},
          removeEventListener() {},
        };
        
        room.handleSocketConnect({ sessionId: 'hydration', socket: dummySocket });
        
        let replayed = 0;
        const encoder = new TextEncoder();
        for (const event of events) {
          if (event.eventType === 'tldraw_update' && event.payload) {
            const data = encoder.encode(JSON.stringify(event.payload));
            room.handleSocketMessage('hydration', { data });
            replayed++;
          }
        }
        
        console.log(`[tldraw-sync] Hydration complete for ${workspaceId}. Replayed ${replayed} updates.`);
        room.handleSocketClose('hydration');
      } else {
        console.log(`[tldraw-sync] Room ${workspaceId} is fresh (no events found)`);
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
      socket: createSocketIoMinimalSocket(socket),
      isReadonly: socket.workspaceRole === "viewer",
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
