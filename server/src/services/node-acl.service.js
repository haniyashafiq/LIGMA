const { pool } = require("../db/pool");

const DEFAULT_ACL = Object.freeze({
  editors: [],
  viewers: [],
  deleteEditors: [],
  publicEdit: false,
  publicView: true,
});

function normalizeIdList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeAcl(acl) {
  const source = acl && typeof acl === "object" ? acl : {};

  return {
    editors: normalizeIdList(source.editors),
    viewers: normalizeIdList(source.viewers),
    deleteEditors: normalizeIdList(source.deleteEditors),
    publicEdit: Boolean(source.publicEdit),
    publicView: source.publicView !== false,
  };
}

function mapAclRow(row) {
  if (!row) {
    return null;
  }

  return {
    workspaceId: row.workspace_id,
    nodeId: row.node_id,
    ownerUserId: row.owner_user_id,
    acl: normalizeAcl(row.acl),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getNodeAcl(workspaceId, nodeId) {
  if (!workspaceId || !nodeId) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT workspace_id, node_id, owner_user_id, acl, created_at, updated_at
      FROM node_acls
      WHERE workspace_id = $1 AND node_id = $2
      LIMIT 1
    `,
    [workspaceId, nodeId],
  );

  return mapAclRow(result.rows[0] || null);
}

async function upsertNodeAcl(workspaceId, nodeId, ownerUserId, acl) {
  if (!workspaceId || !nodeId || !ownerUserId) {
    return null;
  }

  const normalizedAcl = normalizeAcl(acl);

  const result = await pool.query(
    `
      INSERT INTO node_acls (workspace_id, node_id, owner_user_id, acl)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (workspace_id, node_id)
      DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        acl = EXCLUDED.acl,
        updated_at = NOW()
      RETURNING workspace_id, node_id, owner_user_id, acl, created_at, updated_at
    `,
    [workspaceId, nodeId, ownerUserId, JSON.stringify(normalizedAcl)],
  );

  return mapAclRow(result.rows[0]);
}

async function removeNodeAcl(workspaceId, nodeId) {
  if (!workspaceId || !nodeId) {
    return;
  }

  await pool.query(
    `
      DELETE FROM node_acls
      WHERE workspace_id = $1 AND node_id = $2
    `,
    [workspaceId, nodeId],
  );
}

function canUserViewNode(nodeAcl, userId, workspaceRole) {
  if (workspaceRole === "lead") {
    return true;
  }

  if (!nodeAcl) {
    return workspaceRole !== "viewer" ? true : true;
  }

  if (nodeAcl.ownerUserId === userId) {
    return true;
  }

  const acl = normalizeAcl(nodeAcl.acl);
  return acl.publicView || acl.viewers.includes(userId) || acl.editors.includes(userId);
}

function canUserEditNode(nodeAcl, userId, workspaceRole) {
  if (workspaceRole === "lead") {
    return true;
  }

  if (workspaceRole === "viewer") {
    return false;
  }

  if (!nodeAcl) {
    return true;
  }

  if (nodeAcl.ownerUserId === userId) {
    return true;
  }

  const acl = normalizeAcl(nodeAcl.acl);
  return acl.publicEdit || acl.editors.includes(userId);
}

function canUserDeleteNode(nodeAcl, userId, workspaceRole) {
  if (workspaceRole === "lead") {
    return true;
  }

  if (workspaceRole === "viewer") {
    return false;
  }

  if (!nodeAcl) {
    return false;
  }

  if (nodeAcl.ownerUserId === userId) {
    return true;
  }

  const acl = normalizeAcl(nodeAcl.acl);
  return acl.deleteEditors.includes(userId);
}

module.exports = {
  DEFAULT_ACL,
  normalizeAcl,
  getNodeAcl,
  upsertNodeAcl,
  removeNodeAcl,
  canUserViewNode,
  canUserEditNode,
  canUserDeleteNode,
};
