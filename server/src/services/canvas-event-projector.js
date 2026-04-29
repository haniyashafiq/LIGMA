const Y = require("yjs");

function getNodesMap(doc) {
  return doc.getMap("nodes");
}

function getNodeTextsMap(doc) {
  return doc.getMap("nodeTexts");
}

function getMeta(node) {
  return node && typeof node.metadata === "object" && node.metadata
    ? node.metadata
    : {};
}

function getNodeText(doc, nodeId, fallback = "") {
  const text = getNodeTextsMap(doc).get(nodeId);
  if (text && typeof text.toString === "function") {
    return text.toString();
  }
  return typeof fallback === "string" ? fallback : "";
}

function ensureNodeText(doc, nodeId, initialText = "") {
  const texts = getNodeTextsMap(doc);
  let text = texts.get(nodeId);
  if (!text) {
    text = new Y.Text();
    texts.set(nodeId, text);
  }
  if (text.length === 0 && initialText) {
    text.insert(0, initialText);
  }
  return text;
}

function replaceNodeText(doc, nodeId, nextText = "") {
  const text = ensureNodeText(doc, nodeId);
  if (text.length > 0) {
    text.delete(0, text.length);
  }
  if (nextText) {
    text.insert(0, nextText);
  }
}

function getNodeWithText(doc, nodeId) {
  const node = getNodesMap(doc).get(nodeId);
  if (!node) return null;
  return {
    ...node,
    text: getNodeText(doc, nodeId, node.text),
  };
}

function applyTextDelta(doc, nodeId, delta = {}) {
  if (!nodeId) return;
  const text = ensureNodeText(doc, nodeId);
  const index = Math.max(0, Math.min(Number(delta.index) || 0, text.length));
  const deleteCount = Math.max(0, Math.min(Number(delta.delete) || 0, text.length - index));
  const insert = typeof delta.insert === "string" ? delta.insert : "";

  if (deleteCount > 0) {
    text.delete(index, deleteCount);
  }
  if (insert) {
    text.insert(index, insert);
  }
}

function applySemanticEvent(doc, event) {
  const nodes = getNodesMap(doc);
  const payload = event.payload || {};
  const nodeId = event.nodeId || payload.nodeId || payload.node?.id;

  switch (event.eventType) {
    case "canvas:node:create": {
      if (payload.node?.id) {
        nodes.set(payload.node.id, payload.node);
        replaceNodeText(doc, payload.node.id, payload.node.text || "");
      }
      break;
    }
    case "canvas:node:update":
    case "canvas:intent:classified":
      if (payload.node?.id) nodes.set(payload.node.id, payload.node);
      break;
    case "canvas:node:text:delta":
      applyTextDelta(doc, nodeId, payload.delta);
      break;
    case "canvas:node:delete":
      if (nodeId) nodes.delete(nodeId);
      if (nodeId) getNodeTextsMap(doc).delete(nodeId);
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
  applyTextDelta,
  ensureNodeText,
  getNodeText,
  getNodeTextsMap,
  getNodeWithText,
  getNodesMap,
  getMeta,
};
