const config = require("../config");
const intentService = require("./intent.service");
const { normalizeStatusForStorage } = require("./task.service");

const VALID_AI_INTENTS = new Set([
  "action_item",
  "decision",
  "open_question",
  "reference",
  "general",
]);

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
  return normalizeStatusForStorage(rawStatus);
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
    timeoutMs = 8000,
    logPrefix = "[AI Classifier]",
  } = options;

  const preview = String(message).substring(0, 30);
  const attempts = [timeoutMs, timeoutMs + 4000];

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = index + 1;
    const attemptTimeout = attempts[index];

    try {
      console.log(
        `${logPrefix} Attempting Gemini classification for: "${preview}..." (attempt ${attempt}/${attempts.length}, timeout=${attemptTimeout}ms)`,
      );

      const response = await fetch(`${config.AI_SERVICE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(attemptTimeout),
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

        console.warn(`${logPrefix} Gemini returned unusable intent "${data.intent}".`);
      } else {
        console.warn(`${logPrefix} Gemini service returned ${response.status}.`);
      }
    } catch (error) {
      console.warn(`${logPrefix} Gemini attempt ${attempt} failed: ${error.message}`);
    }
  }

  const fallback = classifyWithLocalFallback(message, nodeType);
  console.warn(`${logPrefix} Falling back to local implementation.`);
  console.log(`${logPrefix} Local fallback: intent=${fallback.intent}`);
  return fallback;
}

module.exports = {
  classifyIntent,
  classifyWithLocalFallback,
  normalizeIntent,
  normalizeTaskStatus,
};
