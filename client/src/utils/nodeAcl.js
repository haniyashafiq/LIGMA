function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

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

export function normalizeAcl(acl) {
  const source = acl && typeof acl === "object" ? acl : {};

  return {
    editors: normalizeIdList(source.editors),
    viewers: normalizeIdList(source.viewers),
    deleteEditors: normalizeIdList(source.deleteEditors),
    publicEdit: Boolean(source.publicEdit),
    publicView: source.publicView !== false,
  };
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

export function collectMutations(message) {
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
        acl: getAclFromRecord(record),
      });
    }

    const updatedEntries = isRecord(changes.updated)
      ? Object.values(changes.updated)
      : [];
    for (const entry of updatedEntries) {
      let nextRecord = null;

      if (Array.isArray(entry) && entry.length >= 2) {
        nextRecord = entry[1];
      } else if (isRecord(entry) && (entry.to || entry.from)) {
        nextRecord = entry.to || entry.from;
      } else if (isRecord(entry)) {
        nextRecord = entry;
      }

      const nodeId = getRecordId(nextRecord);
      if (!nodeId) {
        continue;
      }

      mutations.push({
        action: "edit",
        nodeId,
        acl: getAclFromRecord(nextRecord),
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
      });
    }
  }

  return mutations;
}

export function canEditNode(nodeAcl, userId, workspaceRole) {
  if (workspaceRole === "lead") {
    return true;
  }

  if (workspaceRole === "viewer") {
    return false;
  }

  if (!nodeAcl) {
    return true;
  }

  if (!nodeAcl.ownerUserId) {
    return true;
  }

  if (nodeAcl.ownerUserId === userId) {
    return true;
  }

  const acl = normalizeAcl(nodeAcl.acl);
  return acl.publicEdit || acl.editors.includes(userId);
}

export function canDeleteNode(nodeAcl, userId, workspaceRole) {
  if (workspaceRole === "lead") {
    return true;
  }

  if (workspaceRole === "viewer") {
    return false;
  }

  if (!nodeAcl) {
    return true;
  }

  if (!nodeAcl.ownerUserId) {
    return true;
  }

  if (nodeAcl.ownerUserId === userId) {
    return true;
  }

  const acl = normalizeAcl(nodeAcl.acl);
  return acl.deleteEditors.includes(userId);
}

export function applyMutationsToAclCache(cacheMap, mutations, userId) {
  for (const mutation of mutations) {
    if (mutation.action === "create") {
      cacheMap.set(mutation.nodeId, {
        ownerUserId: userId || null,
        acl: normalizeAcl(mutation.acl || {}),
      });
      continue;
    }

    if (mutation.action === "edit" && mutation.acl) {
      const existing = cacheMap.get(mutation.nodeId);
      if (existing) {
        cacheMap.set(mutation.nodeId, {
          ...existing,
          acl: normalizeAcl(mutation.acl),
        });
      }
      continue;
    }

    if (mutation.action === "delete") {
      cacheMap.delete(mutation.nodeId);
    }
  }
}
