const DEFAULT_NODE_SIZE = {
  width: 240,
  height: 180,
};

function getNodeId() {
  return `shape:${window.crypto.randomUUID()}`;
}

function mapNodeTypeToShape(type) {
  switch (type) {
    case 'sticky':
      return 'note';
    case 'text':
      return 'text';
    case 'ellipse':
      return 'geo';
    case 'diamond':
      return 'geo';
    case 'rectangle':
    default:
      return 'geo';
  }
}

function getGeoType(type) {
  switch (type) {
    case 'ellipse':
      return 'ellipse';
    case 'diamond':
      return 'diamond';
    default:
      return 'rectangle';
  }
}

function buildShapeRecord(node) {
  const base = {
    id: node.id,
    type: mapNodeTypeToShape(node.type),
    x: node.x,
    y: node.y,
    meta: {
      ligmaNode: {
        id: node.id,
        nodeType: node.type,
        createdBy: node.createdBy,
        workspaceId: node.workspaceId,
      },
    },
  };

  if (node.type === 'sticky') {
    return {
      ...base,
      props: {
        text: node.content,
        color: 'yellow',
        size: 'm',
      },
    };
  }

  if (node.type === 'text') {
    return {
      ...base,
      props: {
        text: node.content,
        color: 'black',
        size: 'm',
      },
    };
  }

  return {
    ...base,
    props: {
      geo: getGeoType(node.type),
      w: node.width,
      h: node.height,
      color: 'blue',
      fill: 'solid',
      dash: 'draw',
      size: 'm',
      text: node.content,
    },
  };
}

function normalizeNodeData(shape, metadata = {}) {
  const props = shape?.props || {};
  const ligmaMeta = shape?.meta?.ligmaNode || {};
  const type = ligmaMeta.nodeType || (shape?.type === 'note' ? 'sticky' : shape?.type === 'text' ? 'text' : props.geo || 'rectangle');

  return {
    id: shape.id,
    type,
    x: Number(shape.x) || 0,
    y: Number(shape.y) || 0,
    width: Number(props.w) || DEFAULT_NODE_SIZE.width,
    height: Number(props.h) || DEFAULT_NODE_SIZE.height,
    content: props.text || '',
    color: metadata.color || ligmaMeta.color || 'default',
    createdBy: metadata.createdBy || ligmaMeta.createdBy || null,
    workspaceId: metadata.workspaceId || ligmaMeta.workspaceId || null,
  };
}

function hasShape(editor, id) {
  if (!editor || typeof editor.getShape !== 'function' || !id) {
    return false;
  }
  return Boolean(editor.getShape(id));
}

export function createNodeManager({
  workspaceId,
  currentUserId = 'local-user',
  yjsDoc = null,
  onNodeEvent = null,
} = {}) {
  let editor = null;
  let remoteMutationDepth = 0;
  let unsubscribeStore = null;
  let yNodes = yjsDoc?.getMap?.('nodes') || null;

  const nodeMetadata = new Map();

  function setMetadata(node) {
    const metadata = {
      color: node.color,
      createdBy: node.createdBy,
      workspaceId: node.workspaceId,
    };

    nodeMetadata.set(node.id, metadata);

    if (yNodes) {
      yNodes.set(node.id, metadata);
    }
  }

  function emitNodeEvent(eventType, node) {
    if (remoteMutationDepth > 0 || typeof onNodeEvent !== 'function') {
      return;
    }

    onNodeEvent(eventType, {
      ...node,
      serialized: serializeNode(node.id),
    });
  }

  function handleStoreChange(event) {
    if (remoteMutationDepth > 0) {
      return;
    }

    const changes = event?.changes || event;
    if (!changes || typeof changes !== 'object') {
      return;
    }

    const added = Object.values(changes.added || {});
    added.forEach((record) => {
      if (record?.typeName !== 'shape') {
        return;
      }

      const node = normalizeNodeData(record, nodeMetadata.get(record.id));
      emitNodeEvent('canvas:node:create', node);
    });

    const updated = Object.values(changes.updated || {});
    updated.forEach((change) => {
      const nextShape = change?.[1] || change?.after || change;
      const prevShape = change?.[0] || change?.before || null;
      if (nextShape?.typeName !== 'shape') {
        return;
      }

      const node = normalizeNodeData(nextShape, nodeMetadata.get(nextShape.id));
      const didMove = prevShape && (prevShape.x !== nextShape.x || prevShape.y !== nextShape.y);
      emitNodeEvent(didMove ? 'canvas:node:move' : 'canvas:node:update', node);
    });

    const removed = Object.values(changes.removed || {});
    removed.forEach((record) => {
      const previous = Array.isArray(record) ? record[0] : record;
      if (previous?.typeName !== 'shape') {
        return;
      }

      if (typeof onNodeEvent === 'function') {
        onNodeEvent('canvas:node:delete', { id: previous.id });
      }
    });
  }

  function subscribeToStore() {
    if (!editor?.store?.listen) {
      return;
    }

    unsubscribeStore = editor.store.listen(handleStoreChange, {
      scope: 'document',
      source: 'user',
    });
  }

  function createNode(type, partial = {}) {
    if (!editor) {
      return null;
    }

    const id = getNodeId();
    const offset = nodeMetadata.size * 24;
    const node = {
      id,
      type,
      x: partial.x ?? offset,
      y: partial.y ?? offset,
      width: partial.width ?? DEFAULT_NODE_SIZE.width,
      height: partial.height ?? DEFAULT_NODE_SIZE.height,
      content: partial.content ?? (type === 'sticky' ? 'New sticky note' : type === 'text' ? 'New text block' : ''),
      color: partial.color ?? 'default',
      createdBy: partial.createdBy ?? currentUserId,
      workspaceId,
    };

    setMetadata(node);
    editor.createShapes([buildShapeRecord(node)]);
    return node;
  }

  function serializeNode(id) {
    if (!editor || typeof editor.getShape !== 'function') {
      return null;
    }

    const shape = editor.getShape(id);
    if (!shape) {
      return null;
    }

    return normalizeNodeData(shape, nodeMetadata.get(id));
  }

  function applyRemoteDelta(eventType, payload = {}) {
    if (!editor) {
      return;
    }

    remoteMutationDepth += 1;

    try {
      if (eventType === 'canvas:node:delete') {
        const nodeId = payload.id || payload.nodeId;
        if (nodeId && hasShape(editor, nodeId)) {
          editor.deleteShapes([nodeId]);
        }
        nodeMetadata.delete(nodeId);
        if (yNodes && nodeId) {
          yNodes.delete(nodeId);
        }
        return;
      }

      if (eventType === 'canvas:node:create') {
        const node = {
          ...payload,
          workspaceId: payload.workspaceId || workspaceId,
        };
        setMetadata(node);
        if (hasShape(editor, node.id)) {
          editor.updateShapes([buildShapeRecord(node)]);
        } else {
          editor.createShapes([buildShapeRecord(node)]);
        }
        return;
      }

      const existing = editor.getShape?.(payload.id);
      if (!existing) {
        const fallbackNode = {
          ...payload,
          workspaceId: payload.workspaceId || workspaceId,
          type: payload.type || 'rectangle',
          width: payload.width ?? DEFAULT_NODE_SIZE.width,
          height: payload.height ?? DEFAULT_NODE_SIZE.height,
          content: payload.content ?? '',
        };
        setMetadata(fallbackNode);
        editor.createShapes([buildShapeRecord(fallbackNode)]);
        return;
      }

      const nextNode = {
        ...normalizeNodeData(existing, nodeMetadata.get(payload.id)),
        ...payload,
      };
      setMetadata(nextNode);
      editor.updateShapes([buildShapeRecord(nextNode)]);
    } finally {
      remoteMutationDepth -= 1;
    }
  }

  return {
    attach(nextEditor) {
      editor = nextEditor || null;
      subscribeToStore();
    },
    detach() {
      if (typeof unsubscribeStore === 'function') {
        unsubscribeStore();
      }
      unsubscribeStore = null;
      editor = null;
    },
    createStickyNote(partial = {}) {
      return createNode('sticky', partial);
    },
    createTextBlock(partial = {}) {
      return createNode('text', partial);
    },
    createShape(shapeType = 'rectangle', partial = {}) {
      return createNode(shapeType, partial);
    },
    bindYjsDoc(nextDoc) {
      yNodes = nextDoc?.getMap?.('nodes') || null;
      if (!yNodes) {
        return;
      }

      for (const [id, metadata] of nodeMetadata.entries()) {
        yNodes.set(id, metadata);
      }
    },
    serializeNode,
    getNodeSnapshot(id) {
      return serializeNode(id);
    },
    applyRemoteDelta,
  };
}
