const QUESTION_WORDS = /\b(who|what|when|where|why|how|should|could|can|do we|is there|are we)\b/i;
const ACTION_WORDS = /\b(todo|to do|action|follow up|follow-up|assign|owner|fix|build|ship|send|write|review|update|create|implement|schedule|investigate|need to|must|next step)\b/i;
const DECISION_WORDS = /\b(decision|decided|agreed|approved|rejected|we will|we won't|chosen|choose|selected|final)\b/i;
const REFERENCE_WORDS = /\b(ref|reference|link|doc|docs|note|context|fyi|background|source|see also)\b/i;

function normalizeText(text) {
  return typeof text === "string" ? text.trim() : "";
}

function classifyIntent(text) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return {
      intent: "reference",
      confidence: 0.35,
      reason: "Empty or non-text canvas content is treated as reference material.",
    };
  }

  if (normalized.includes("?") || QUESTION_WORDS.test(normalized)) {
    return {
      intent: "open_question",
      confidence: 0.86,
      reason: "Question phrasing or punctuation detected.",
    };
  }

  if (DECISION_WORDS.test(normalized)) {
    return {
      intent: "decision",
      confidence: 0.82,
      reason: "Decision-oriented wording detected.",
    };
  }

  if (ACTION_WORDS.test(normalized) || /^\s*[-*]?\s*\[[ x]\]/i.test(normalized)) {
    return {
      intent: "action_item",
      confidence: 0.84,
      reason: "Action-oriented wording detected.",
    };
  }

  if (REFERENCE_WORDS.test(normalized) || /^https?:\/\//i.test(normalized)) {
    return {
      intent: "reference",
      confidence: 0.76,
      reason: "Reference-oriented wording detected.",
    };
  }

  return {
    intent: "reference",
    confidence: 0.58,
    reason: "No strong action, decision, or question signal detected.",
  };
}

module.exports = {
  classifyIntent,
};
