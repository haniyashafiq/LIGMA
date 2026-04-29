const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyIntent, classifyIntentForNode } = require("./intent.service");

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

test("imperative openings are action items", () => {
  assert.equal(classifyIntent("Call Alice about pricing").intent, "action_item");
  assert.equal(classifyIntent("Please review the Q3 deck").intent, "action_item");
});

test("sticky notes promote weak reference text to action items", () => {
  assert.equal(classifyIntent("Team lunch Friday").intent, "reference");
  assert.equal(classifyIntentForNode("Team lunch Friday", "note").intent, "action_item");
});

test("sticky notes keep questions and explicit FYI references", () => {
  assert.equal(classifyIntentForNode("Should we postpone?", "note").intent, "open_question");
  assert.equal(classifyIntentForNode("FYI: design moved the dates", "note").intent, "reference");
});

test("floating text does not promote default reference to action", () => {
  assert.equal(classifyIntentForNode("Team lunch Friday", "text").intent, "reference");
});
