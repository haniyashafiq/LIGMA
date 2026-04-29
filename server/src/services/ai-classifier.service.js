const config = require("../config");
const intentService = require("./intent.service");

const VALID_AI_INTENTS = new Set([
  "action_item",
  "decision",
  "open_question",
  "reference",
  "general",
]);
const VALID_TASK_STATUSES = new Set(["todo", "in_progress", "done"]);

function normalizeIntent(rawIntent) {
  const intent = String(rawIntent || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (intent === "action") return "action_item";
  if (intent === "question") return "open_question";

  return VALID_AI_INTENTS.has(intent) ? intent : null;
}

function normalizeTaskStatus(rawStatus) {
  const status = String(rawStatus || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (status === "doing") return "in_progress";

  return VALID_TASK_STATUSES.has(status) ? status : "todo";
}

function classifyWithLocalFallback(message, nodeType) {
  const localResult = intentService.classifyIntentForNode(message, nodeType || "note");

  return {
    intent: localResult.intent,
    status: "todo",
    source: "local",
    confidence: localResult.confidence,
    reason: localResult.reason,
  };
}

async function classifyIntent(message, options = {}) {
  const {
    nodeType = "note",
    timeoutMs = 3000,
    logPrefix = "[AI Classifier]",
  } = options;

  try {
    const preview = String(message).substring(0, 30);
    console.log(`${logPrefix} Attempting Gemini classification for: "${preview}..."`);

    const response = await fetch(`${config.AI_SERVICE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      const data = await response.json();
      const intent = normalizeIntent(data.intent || data.reply);

      if (intent) {
        console.log(`${logPrefix} Gemini success: intent=${intent}, status=${data.status || "todo"}`);
        return {
          intent,
          status: normalizeTaskStatus(data.status),
          source: "ai",
          confidence: typeof data.confidence === "number" ? data.confidence : null,
          reason: "Gemini intent classification.",
        };
      }

      console.warn(`${logPrefix} Gemini returned unusable intent "${data.intent}". Falling back to local.`);
    } else {
      console.warn(`${logPrefix} Gemini service returned ${response.status}. Falling back to local.`);
    }
  } catch (error) {
    console.warn(`${logPrefix} Gemini unreachable or timed out: ${error.message}. Falling back to local.`);
  }

  const fallback = classifyWithLocalFallback(message, nodeType);
  console.log(`${logPrefix} Local fallback: intent=${fallback.intent}`);
  return fallback;
}

module.exports = {
  classifyIntent,
  classifyWithLocalFallback,
  normalizeIntent,
  normalizeTaskStatus,
};
