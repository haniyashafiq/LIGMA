const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../db/pool');

const templateService = require('./template.service');

const VALID_ROLES = new Set(['lead', 'contributor', 'viewer']);
const INVITE_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRole(role) {
  if (typeof role !== 'string') {
    return '';
  }

  return role.trim().toLowerCase();
}

function mapWorkspace(row) {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    role: row.role || null,
  };
}

function mapMember(row) {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    color: row.color,
    role: row.role,
  };
}

async function createWorkspace(name, creatorId, templateId = null) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    throw createHttpError('Workspace name is required.', 400);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const workspaceInsert = await client.query(
      `
        INSERT INTO workspaces (name, created_by)
        VALUES ($1, $2)
        RETURNING id, name, created_by, created_at
      `,
      [trimmedName, creatorId]
    );

    const workspace = workspaceInsert.rows[0];

    await client.query(
      `
        INSERT INTO workspace_roles (workspace_id, user_id, role)
        VALUES ($1, $2, 'lead')
      `,
      [workspace.id, creatorId]
    );

    await client.query('COMMIT');

    // Seed if template provided
    if (templateId) {
      await templateService.seedWorkspace(workspace.id, templateId, creatorId).catch(err => {
        console.error('[workspace.service] Template seeding failed', err);
      });
    }

    return {
      ...mapWorkspace(workspace),
      role: 'lead',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listUserWorkspaces(userId) {
  const result = await pool.query(
    `
      SELECT w.id, w.name, w.created_by, w.created_at, wr.role
      FROM workspace_roles wr
      INNER JOIN workspaces w ON w.id = wr.workspace_id
      WHERE wr.user_id = $1
      ORDER BY w.created_at DESC
    `,
    [userId]
  );

  return result.rows.map(mapWorkspace);
}

async function getWorkspaceWithMembers(workspaceId, userId) {
  const membership = await pool.query(
    `
      SELECT role
      FROM workspace_roles
      WHERE workspace_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [workspaceId, userId]
  );

  const role = membership.rows[0]?.role || null;
  if (!role) {
    throw createHttpError('Workspace access denied.', 403);
  }

  const workspaceResult = await pool.query(
    `
      SELECT id, name, created_by, created_at
      FROM workspaces
      WHERE id = $1
      LIMIT 1
    `,
    [workspaceId]
  );

  const workspaceRow = workspaceResult.rows[0];
  if (!workspaceRow) {
    throw createHttpError('Workspace not found.', 404);
  }

  const membersResult = await pool.query(
    `
      SELECT wr.user_id, wr.role, u.username, u.display_name, u.color
      FROM workspace_roles wr
      INNER JOIN users u ON u.id = wr.user_id
      WHERE wr.workspace_id = $1
      ORDER BY
        CASE wr.role
          WHEN 'lead' THEN 0
          WHEN 'contributor' THEN 1
          ELSE 2
        END,
        u.username ASC
    `,
    [workspaceId]
  );

  return {
    workspace: {
      ...mapWorkspace(workspaceRow),
      role,
    },
    members: membersResult.rows.map(mapMember),
  };
}

async function inviteUser(workspaceId, username, role) {
  const normalizedRole = normalizeRole(role);
  const trimmedUsername = typeof username === 'string' ? username.trim() : '';

  if (!trimmedUsername) {
    throw createHttpError('Username is required.', 400);
  }

  if (!VALID_ROLES.has(normalizedRole)) {
    throw createHttpError('Invalid role.', 400);
  }

  const userResult = await pool.query(
    `
      SELECT id, username, display_name, color
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
    [trimmedUsername]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw createHttpError('User not found.', 404);
  }

  await pool.query(
    `
      INSERT INTO workspace_roles (workspace_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (workspace_id, user_id)
      DO UPDATE SET role = EXCLUDED.role
    `,
    [workspaceId, user.id, normalizedRole]
  );

  return {
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    color: user.color,
    role: normalizedRole,
  };
}

async function updateUserRole(workspaceId, targetUserId, role) {
  const normalizedRole = normalizeRole(role);
  if (!VALID_ROLES.has(normalizedRole)) {
    throw createHttpError('Invalid role.', 400);
  }

  const result = await pool.query(
    `
      UPDATE workspace_roles
      SET role = $3
      WHERE workspace_id = $1 AND user_id = $2
      RETURNING workspace_id, user_id, role
    `,
    [workspaceId, targetUserId, normalizedRole]
  );

  const row = result.rows[0];
  if (!row) {
    throw createHttpError('Workspace member not found.', 404);
  }

  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
  };
}

function createInviteToken(workspaceId, role) {
  const normalizedRole = normalizeRole(role);
  if (!VALID_ROLES.has(normalizedRole)) {
    throw createHttpError('Invalid role.', 400);
  }

  const token = jwt.sign(
    {
      type: 'workspace_invite',
      workspaceId: String(workspaceId),
      role: normalizedRole,
    },
    config.JWT_SECRET,
    { expiresIn: INVITE_TOKEN_TTL_SECONDS }
  );

  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_SECONDS * 1000).toISOString();

  return { token, role: normalizedRole, expiresAt };
}

function verifyInviteToken(token) {
  let payload;

  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch (_error) {
    throw createHttpError('Invalid or expired invite link.', 400);
  }

  if (
    payload?.type !== 'workspace_invite' ||
    !payload?.workspaceId ||
    !VALID_ROLES.has(normalizeRole(payload.role))
  ) {
    throw createHttpError('Invalid invite payload.', 400);
  }

  return {
    workspaceId: String(payload.workspaceId),
    role: normalizeRole(payload.role),
  };
}

async function acceptInviteToken(token, userId) {
  if (typeof token !== 'string' || !token.trim()) {
    throw createHttpError('Invite token is required.', 400);
  }

  const invite = verifyInviteToken(token.trim());

  await pool.query(
    `
      INSERT INTO workspace_roles (workspace_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (workspace_id, user_id)
      DO NOTHING
    `,
    [invite.workspaceId, userId, invite.role]
  );

  const membership = await pool.query(
    `
      SELECT role
      FROM workspace_roles
      WHERE workspace_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [invite.workspaceId, userId]
  );

  return {
    ...invite,
    appliedRole: membership.rows[0]?.role || invite.role,
  };
}

module.exports = {
  VALID_ROLES,
  createWorkspace,
  listUserWorkspaces,
  getWorkspaceWithMembers,
  inviteUser,
  updateUserRole,
  createInviteToken,
  acceptInviteToken,
};
