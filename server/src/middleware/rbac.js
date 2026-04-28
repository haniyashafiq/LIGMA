const { pool } = require('../db/pool');

const ROLE_WEIGHT = {
  viewer: 0,
  contributor: 1,
  lead: 2,
};

const ACTION_MIN_ROLE = {
  create: 'contributor',
  edit: 'contributor',
  move: 'contributor',
  delete: 'contributor',
};

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRole(role) {
  return typeof role === 'string' ? role.toLowerCase() : '';
}

function hasAtLeastRole(currentRole, requiredRole) {
  return (
    Number.isInteger(ROLE_WEIGHT[currentRole]) &&
    Number.isInteger(ROLE_WEIGHT[requiredRole]) &&
    ROLE_WEIGHT[currentRole] >= ROLE_WEIGHT[requiredRole]
  );
}

async function getUserWorkspaceRole(workspaceId, userId) {
  const result = await pool.query(
    `
      SELECT role
      FROM workspace_roles
      WHERE workspace_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [workspaceId, userId]
  );

  const row = result.rows[0];
  return row ? normalizeRole(row.role) : null;
}

function resolveWorkspaceId(req) {
  return req.params?.id || req.params?.workspaceId || req.body?.workspaceId || null;
}

function requireRole(...roles) {
  const acceptedRoles = roles.map(normalizeRole).filter(Boolean);

  return async function requireRoleMiddleware(req, res, next) {
    const workspaceId = resolveWorkspaceId(req);

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!workspaceId) {
      return res.status(400).json({ message: 'Workspace id is required.' });
    }

    try {
      const role = await getUserWorkspaceRole(workspaceId, req.user.id);

      if (!role) {
        return res.status(403).json({ message: 'Workspace access denied.' });
      }

      if (acceptedRoles.length > 0 && !acceptedRoles.includes(role)) {
        return res.status(403).json({ message: 'Insufficient workspace role.' });
      }

      req.workspaceRole = role;
      return next();
    } catch (_error) {
      return res.status(500).json({ message: 'Failed to verify workspace role.' });
    }
  };
}

async function getNodeCreatorId(workspaceId, nodeId) {
  const result = await pool.query(
    `
      SELECT user_id
      FROM canvas_events
      WHERE workspace_id = $1
        AND node_id = $2
        AND event_type = 'canvas:node:create'
      ORDER BY sequence_num ASC
      LIMIT 1
    `,
    [workspaceId, nodeId]
  );

  return result.rows[0]?.user_id || null;
}

async function checkNodePermission(action, nodeId, userId, workspaceId) {
  const normalizedAction = typeof action === 'string' ? action.toLowerCase() : '';

  if (!userId || !workspaceId || !normalizedAction) {
    throw createHttpError('Missing permission context.', 400);
  }

  const role = await getUserWorkspaceRole(workspaceId, userId);

  if (!role) {
    return false;
  }

  if (role === 'lead') {
    return true;
  }

  if (role === 'viewer') {
    return false;
  }

  const minimumRole = ACTION_MIN_ROLE[normalizedAction];
  if (!minimumRole || !hasAtLeastRole(role, minimumRole)) {
    return false;
  }

  if (normalizedAction === 'delete') {
    if (!nodeId) {
      return false;
    }

    const nodeCreatorId = await getNodeCreatorId(workspaceId, nodeId);
    if (!nodeCreatorId) {
      // Some transports (e.g. tldraw sync) maintain owner ACL directly in the
      // document record. Callers should apply that stricter node ownership check.
      return true;
    }

    return nodeCreatorId === userId;
  }

  return true;
}

module.exports = {
  ROLE_WEIGHT,
  ACTION_MIN_ROLE,
  getUserWorkspaceRole,
  requireRole,
  checkNodePermission,
};
