const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyIntent } = require("./intent.service");

test("classifies action items without paid integrations", () => {
  assert.equal(classifyIntent("Action item: follow up with design").intent, "action_item");
});

test("classifies decisions and open questions", () => {
  assert.equal(classifyIntent("Decision: we will ship the compact toolbar").intent, "decision");
  assert.equal(classifyIntent("Should we lock this diagram?").intent, "open_question");
});

test("falls back to reference for neutral context", () => {
  assert.equal(classifyIntent("Reference docs for the onboarding flow").intent, "reference");
});
