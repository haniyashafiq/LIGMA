const eventService = require('./event.service');
const Y = require('yjs');

const TEMPLATE_DEFINITIONS = {
  microservices: [
    { type: 'note', text: 'Gateway', x: 400, y: 100, style: { fill: 'rgba(13, 153, 255, 0.1)' } },
    { type: 'note', text: 'Auth Service', x: 250, y: 250, style: { fill: 'rgba(162, 89, 255, 0.1)' } },
    { type: 'note', text: 'User Service', x: 400, y: 250, style: { fill: 'rgba(162, 89, 255, 0.1)' } },
    { type: 'note', text: 'Order Service', x: 550, y: 250, style: { fill: 'rgba(162, 89, 255, 0.1)' } },
    { type: 'note', text: 'PostgreSQL', x: 400, y: 400, style: { fill: 'rgba(34, 197, 94, 0.1)' } },
  ],
  'er-diagram': [
    { type: 'rect', text: 'Users Table\n- id: UUID\n- email: String', x: 200, y: 150, width: 200, height: 120 },
    { type: 'rect', text: 'Orders Table\n- id: UUID\n- userId: UUID', x: 500, y: 150, width: 200, height: 120 },
  ],
  'user-journey': [
    { type: 'note', text: '1. Landing Page', x: 100, y: 200 },
    { type: 'note', text: '2. Sign Up / Login', x: 350, y: 200 },
    { type: 'note', text: '3. Core Dashboard', x: 600, y: 200 },
  ],
  'security-audit': [
    { type: 'note', text: 'External Firewall', x: 400, y: 50, style: { fill: 'rgba(239, 68, 68, 0.1)' } },
    { type: 'note', text: 'Public Subnet (DMZ)', x: 400, y: 200, style: { fill: 'rgba(245, 158, 11, 0.1)' } },
    { type: 'note', text: 'Private Subnet', x: 400, y: 350, style: { fill: 'rgba(34, 197, 94, 0.1)' } },
  ],
};

async function seedWorkspace(workspaceId, templateId, creatorId) {
  const nodes = TEMPLATE_DEFINITIONS[templateId];
  if (!nodes) return;

  const now = new Date().toISOString();
  
  for (let i = 0; i < nodes.length; i++) {
    const nodeDef = nodes[i];
    const nodeId = `node-${Date.now()}-${i}`;
    
    const node = {
      id: nodeId,
      type: nodeDef.type || 'note',
      x: nodeDef.x || 0,
      y: nodeDef.y || 0,
      width: nodeDef.width || 180,
      height: nodeDef.height || 90,
      rotation: 0,
      zIndex: i + 1,
      text: nodeDef.text || '',
      points: [],
      style: nodeDef.style || {},
      metadata: {
        authorId: creatorId,
        authorName: 'System (Template)',
        createdAt: now,
        updatedAt: now,
      }
    };

    // Create Yjs update for this node creation
    const doc = new Y.Doc();
    const nodesMap = doc.getMap('nodes');
    const nodeTexts = doc.getMap('nodeTexts');
    
    nodesMap.set(nodeId, node);
    const ytext = new Y.Text();
    ytext.insert(0, node.text);
    nodeTexts.set(nodeId, ytext);
    
    const update = Buffer.from(Y.encodeStateAsUpdate(doc));

    await eventService.appendEvent(
      workspaceId,
      creatorId,
      'canvas:node:create',
      nodeId,
      { node },
      update
    );
  }
}

module.exports = {
  seedWorkspace,
  TEMPLATES: Object.keys(TEMPLATE_DEFINITIONS),
};
