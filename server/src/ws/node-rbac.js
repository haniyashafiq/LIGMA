const { checkNodePermission } = require("../middleware/rbac");
const {
  getNodeAcl,
  upsertNodeAcl,
  removeNodeAcl,
  normalizeAcl,
  canUserEditNode,
  canUserDeleteNode,
} = require("../services/node-acl.service");

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function getRecordId(record) {
  return typeof record?.id === "string" && record.id.trim() ? record.id.trim() : null;
}

function getAclFromRecord(record) {
  if (!isRecord(record)) {
    return null;
  }

  const acl = record.meta?.acl;
  if (!acl || typeof acl !== "object") {
    return null;
  }

  return normalizeAcl(acl);
}

function readUpdateDiff(update) {
  if (!isRecord(update)) {
    return null;
  }

  if (isRecord(update.changes)) {
    return update.changes;
  }

  if (isRecord(update.diff)) {
    return update.diff;
  }

  return null;
}

function collectMutations(message) {
  if (!isRecord(message) || message.type !== "update" || !Array.isArray(message.updates)) {
    return [];
  }

  const mutations = [];

  for (const update of message.updates) {
    const changes = readUpdateDiff(update);
    if (!changes) {
      continue;
    }

    const added = isRecord(changes.added) ? Object.values(changes.added) : [];
    for (const record of added) {
      const nodeId = getRecordId(record);
      if (!nodeId) {
        continue;
      }

      mutations.push({
        action: "create",
        nodeId,
        nextRecord: record,
        nextAcl: getAclFromRecord(record),
      });
    }

    const updatedEntries = isRecord(changes.updated)
      ? Object.values(changes.updated)
      : [];
    for (const entry of updatedEntries) {
      let previousRecord = null;
      let nextRecord = null;

      if (Array.isArray(entry) && entry.length >= 2) {
        previousRecord = entry[0];
        nextRecord = entry[1];
      } else if (isRecord(entry) && (entry.from || entry.to)) {
        previousRecord = entry.from || null;
        nextRecord = entry.to || null;
      } else if (isRecord(entry)) {
        nextRecord = entry;
      }

      const nodeId = getRecordId(nextRecord) || getRecordId(previousRecord);
      if (!nodeId) {
        continue;
      }

      mutations.push({
        action: "edit",
        nodeId,
        previousRecord,
        nextRecord,
        previousAcl: getAclFromRecord(previousRecord),
        nextAcl: getAclFromRecord(nextRecord),
      });
    }

    const removed = isRecord(changes.removed) ? Object.values(changes.removed) : [];
    for (const record of removed) {
      const nodeId = getRecordId(record);
      if (!nodeId) {
        continue;
      }

      mutations.push({
        action: "delete",
        nodeId,
        previousRecord: record,
      });
    }
  }

  return mutations;
}

async function enforceNodeAclForMessage({
  message,
  workspaceId,
  workspaceRole,
  userId,
}) {
  const mutations = collectMutations(message);

  for (const mutation of mutations) {
    const baselineAllowed = await checkNodePermission(
      mutation.action,
      mutation.nodeId,
      userId,
      workspaceId,
    );

    if (!baselineAllowed) {
      return {
        allowed: false,
        reason: "Workspace role denied.",
        action: mutation.action,
        nodeId: mutation.nodeId,
      };
    }

    if (mutation.action === "create") {
      const initialAcl = mutation.nextAcl || null;
      await upsertNodeAcl(workspaceId, mutation.nodeId, userId, initialAcl);
      continue;
    }

    const nodeAcl = await getNodeAcl(workspaceId, mutation.nodeId);

    if (mutation.action === "delete") {
      const canDelete = canUserDeleteNode(nodeAcl, userId, workspaceRole);
      if (!canDelete) {
        return {
          allowed: false,
          reason: "Node ACL denied delete.",
          action: mutation.action,
          nodeId: mutation.nodeId,
        };
      }

      await removeNodeAcl(workspaceId, mutation.nodeId);
      continue;
    }

    const canEdit = canUserEditNode(nodeAcl, userId, workspaceRole);
    if (!canEdit) {
      return {
        allowed: false,
        reason: "Node ACL denied edit.",
        action: mutation.action,
        nodeId: mutation.nodeId,
      };
    }

    const aclChanged =
      Boolean(mutation.nextAcl) &&
      JSON.stringify(mutation.previousAcl || {}) !== JSON.stringify(mutation.nextAcl);

    if (aclChanged) {
      const isOwner = nodeAcl?.ownerUserId === userId;
      const canManageAcl = workspaceRole === "lead" || isOwner;
      if (!canManageAcl) {
        return {
          allowed: false,
          reason: "Only owner or lead can change ACL.",
          action: mutation.action,
          nodeId: mutation.nodeId,
        };
      }
    }

    if (mutation.nextAcl && nodeAcl) {
      await upsertNodeAcl(workspaceId, mutation.nodeId, nodeAcl.ownerUserId, mutation.nextAcl);
    }
  }

  return { allowed: true };
}

module.exports = {
  collectMutations,
  enforceNodeAclForMessage,
};
