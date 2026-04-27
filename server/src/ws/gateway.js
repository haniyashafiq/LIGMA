const { Server } = require('socket.io');
const config = require('../config');
const { pool } = require('../db/pool');
const { authenticateSocket } = require('../middleware/auth');
const { getUserWorkspaceRole } = require('../middleware/rbac');
const { registerSocketHandlers } = require('./handlers');
const { createYjsSyncManager } = require('./yjs-sync');

const connections = new Map();

function parseWorkspaceId(socket) {
  const workspaceId = socket?.handshake?.auth?.workspaceId;

  if (typeof workspaceId !== 'string' || workspaceId.trim().length === 0) {
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
    [userId]
  );

  return result.rows[0] || null;
}

function attachGateway(server) {
  const io = new Server(server, {
    cors: {
      origin: config.CLIENT_URL,
      credentials: true,
    },
  });
  const yjsSyncManager = createYjsSyncManager(io);

  io.use(authenticateSocket);

  io.use(async (socket, next) => {
    try {
      const workspaceId = parseWorkspaceId(socket);

      if (!workspaceId) {
        return next(new Error('workspaceId is required for socket connection.'));
      }

      const role = await getUserWorkspaceRole(workspaceId, socket.user.id);
      if (!role) {
        return next(new Error('Workspace access denied.'));
      }

      socket.workspaceId = workspaceId;
      socket.workspaceRole = role;
      return next();
    } catch (_error) {
      return next(new Error('Failed to verify workspace membership.'));
    }
  });

  io.on('connection', async (socket) => {
    const workspaceId = socket.workspaceId;
    const room = `room:${workspaceId}`;
    const profile = await getUserPresenceProfile(socket.user.id).catch(() => null);

    const presence = {
      userId: socket.user.id,
      workspaceId,
      username: profile?.username || socket.user.username,
      color: profile?.color || '#6366f1',
    };

    connections.set(socket.id, presence);
    socket.join(room);

    socket.emit('server:ready', {
      socketId: socket.id,
      user: presence,
      workspaceRole: socket.workspaceRole,
    });

    socket.to(room).emit('presence:join', {
      socketId: socket.id,
      user: presence,
    });

    await yjsSyncManager.handleWorkspaceJoin(socket);
    registerSocketHandlers(io, socket, { yjsSyncManager });

    socket.on('disconnect', async () => {
      const disconnectedPresence = connections.get(socket.id);
      connections.delete(socket.id);

      socket.to(room).emit('presence:leave', {
        socketId: socket.id,
        user: disconnectedPresence || presence,
      });

      await yjsSyncManager.cleanupWorkspaceIfUnused(workspaceId);
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
