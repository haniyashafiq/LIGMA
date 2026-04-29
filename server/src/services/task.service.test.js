const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeStatusForStorage,
  normalizePriority,
} = require("./task.service");

test("normalizeStatusForStorage maps doing to in_progress", () => {
  assert.equal(normalizeStatusForStorage("doing"), "in_progress");
  assert.equal(normalizeStatusForStorage("DOING"), "in_progress");
  assert.equal(normalizeStatusForStorage("in_progress"), "in_progress");
  assert.equal(normalizeStatusForStorage("todo"), "todo");
  assert.equal(normalizeStatusForStorage("done"), "done");
});

test("normalizePriority defaults invalid values to medium", () => {
  assert.equal(normalizePriority("HIGH"), "high");
  assert.equal(normalizePriority("oops"), "medium");
  assert.equal(normalizePriority(), "medium");
});
