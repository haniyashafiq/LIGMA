const { Server } = require("socket.io");
const config = require("../config");
const { pool } = require("../db/pool");
const { authenticateSocket } = require("../middleware/auth");
const { getUserWorkspaceRole } = require("../middleware/rbac");
const { createTldrawSyncManager } = require("./tldraw-sync");

const connections = new Map();

function parseWorkspaceId(socket) {
  const workspaceId = socket?.handshake?.auth?.workspaceId;

  if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
    return null;
  }

  return workspaceId.trim();
}

async function getUserPresenceProfile(userId) {
  const result = await pool.query(
    `
      SELECT id, username, color
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] || null;
}

function attachGateway(server) {
  const io = new Server(server, {
    cors: {
      origin: config.CLIENT_ORIGINS,
      credentials: true,
    },
  });
  const tldrawSyncManager = createTldrawSyncManager(io);

  io.use(authenticateSocket);

  io.use(async (socket, next) => {
    try {
      if (config.DEBUG_SOCKET_LOGS) {
        console.debug("[gateway] socket handshake.auth", {
          auth: {
            ...socket.handshake.auth,
            token: socket.handshake.auth?.token ? "[REDACTED]" : null,
          },
          socketId: socket.id,
        });
      }
      const workspaceId = parseWorkspaceId(socket);

      if (!workspaceId) {
        console.log("[gateway] missing workspaceId in handshake", socket.id);
        return next(
          new Error("workspaceId is required for socket connection."),
        );
      }

      const role = await getUserWorkspaceRole(workspaceId, socket.user.id);
      if (!role) {
        if (config.DEBUG_SOCKET_LOGS) {
          console.debug("[gateway] user has no role for workspace", {
            userId: socket.user.id,
            workspaceId,
            socketId: socket.id,
          });
        }
        return next(new Error("Workspace access denied."));
      }

      socket.workspaceId = workspaceId;
      socket.workspaceRole = role;
      return next();
    } catch (_error) {
      return next(new Error("Failed to verify workspace membership."));
    }
  });

  io.on("connection", async (socket) => {
    if (config.DEBUG_SOCKET_LOGS) {
      console.debug("[gateway] connection established", {
        socketId: socket.id,
        user: socket.user,
        workspaceId: socket.handshake?.auth?.workspaceId,
      });
    }
    const workspaceId = socket.workspaceId;
    const room = `room:${workspaceId}`;

    // Attach the tldraw sync room immediately so the client's initial connect
    // message cannot arrive before the room listener is ready.
    await tldrawSyncManager.handleWorkspaceJoin(socket);

    const profile = await getUserPresenceProfile(socket.user.id).catch(
      () => null,
    );

    const presence = {
      userId: socket.user.id,
      workspaceId,
      username: profile?.username || socket.user.username,
      color: profile?.color || "#6366f1",
    };

    connections.set(socket.id, presence);
    socket.join(room);

    socket.emit("server:ready", {
      socketId: socket.id,
      user: presence,
      workspaceRole: socket.workspaceRole,
    });

    socket.to(room).emit("presence:join", {
      socketId: socket.id,
      user: presence,
    });

    socket.on("disconnect", async () => {
      const disconnectedPresence = connections.get(socket.id);
      connections.delete(socket.id);

      socket.to(room).emit("presence:leave", {
        socketId: socket.id,
        user: disconnectedPresence || presence,
      });

      await tldrawSyncManager.cleanupWorkspaceIfUnused(workspaceId);
    });
  });

  return io;
}

function getConnectionsSnapshot() {
  return Array.from(connections.entries()).map(([socketId, payload]) => ({
    socketId,
    ...payload,
  }));
}

module.exports = {
  attachGateway,
  getConnectionsSnapshot,
};
