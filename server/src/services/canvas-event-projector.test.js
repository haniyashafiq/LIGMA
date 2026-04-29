const test = require("node:test");
const assert = require("node:assert/strict");
const Y = require("yjs");
const { applySemanticEvent, getNodesMap } = require("./canvas-event-projector");

function makeNode(overrides = {}) {
  return {
    id: "node:test",
    type: "note",
    x: 10,
    y: 20,
    width: 180,
    height: 90,
    text: "Action item: write tests",
    metadata: { authorId: "user:1" },
    ...overrides,
  };
}

test("replaying semantic events converges to the same Yjs state", () => {
  const events = [
    {
      eventType: "canvas:node:create",
      nodeId: "node:test",
      payload: { node: makeNode() },
    },
    {
      eventType: "canvas:node:update",
      nodeId: "node:test",
      payload: { node: makeNode({ x: 42, text: "Decision: ship it" }) },
    },
    {
      eventType: "canvas:node:lock",
      nodeId: "node:test",
      userId: "lead:1",
      payload: { nodeId: "node:test", lockedBy: "lead:1" },
    },
  ];

  const left = new Y.Doc();
  const right = new Y.Doc();
  events.forEach((event) => applySemanticEvent(left, event));
  events.forEach((event) => applySemanticEvent(right, event));

  assert.deepEqual(getNodesMap(left).toJSON(), getNodesMap(right).toJSON());
  assert.equal(getNodesMap(left).get("node:test").metadata.lockedBy, "lead:1");
});

test("delete events remove nodes during missed-event replay", () => {
  const doc = new Y.Doc();
  applySemanticEvent(doc, {
    eventType: "canvas:node:create",
    nodeId: "node:test",
    payload: { node: makeNode() },
  });
  applySemanticEvent(doc, {
    eventType: "canvas:node:delete",
    nodeId: "node:test",
    payload: { nodeId: "node:test" },
  });

  assert.equal(getNodesMap(doc).has("node:test"), false);
});
