function getNodesMap(doc) {
  return doc.getMap("nodes");
}

function getMeta(node) {
  return node && typeof node.metadata === "object" && node.metadata
    ? node.metadata
    : {};
}

function applySemanticEvent(doc, event) {
  const nodes = getNodesMap(doc);
  const payload = event.payload || {};
  const nodeId = event.nodeId || payload.nodeId || payload.node?.id;

  switch (event.eventType) {
    case "canvas:node:create":
    case "canvas:node:update":
    case "canvas:intent:classified":
      if (payload.node?.id) nodes.set(payload.node.id, payload.node);
      break;
    case "canvas:node:delete":
      if (nodeId) nodes.delete(nodeId);
      break;
    case "canvas:node:lock": {
      const node = nodes.get(nodeId);
      if (node) {
        nodes.set(nodeId, {
          ...node,
          metadata: { ...getMeta(node), lockedBy: payload.lockedBy || event.userId || null },
        });
      }
      break;
    }
    case "canvas:node:unlock": {
      const node = nodes.get(nodeId);
      if (node) {
        nodes.set(nodeId, { ...node, metadata: { ...getMeta(node), lockedBy: null } });
      }
      break;
    }
    case "canvas:node:permission:update": {
      const node = nodes.get(nodeId);
      if (node) {
        nodes.set(nodeId, {
          ...node,
          metadata: { ...getMeta(node), permissions: payload.permissions || {} },
        });
      }
      break;
    }
    default:
      break;
  }
}

module.exports = {
  applySemanticEvent,
  getNodesMap,
  getMeta,
};
