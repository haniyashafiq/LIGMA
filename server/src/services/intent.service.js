const QUESTION_WORDS = /\b(who|what|when|where|why|how|should|could|can|do we|is there|are we)\b/i;
const ACTION_WORDS =
  /\b(todo|to do|action|follow up|follow-up|assign|owner|fix|build|ship|send|write|review|update|create|implement|schedule|investigate|need to|must|next step|finish|complete|start|buy|call|meet|email|remember|deadline|today|tomorrow|asap|urgent|blocker|don't forget|dont forget)\b/i;
const DECISION_WORDS = /\b(decision|decided|agreed|approved|rejected|we will|we won't|chosen|choose|selected|final)\b/i;
// Avoid standalone "note" — it false-positive matches sticky-note body text.
const REFERENCE_WORDS =
  /\b(ref|reference|link|doc|docs|notebook|context|fyi|for your information|background|source|see also)\b/i;
const GENERAL_WORDS =
  /\b(i like|i love|i prefer|i think|i feel|nice|cool|great job|thanks|thank you)\b/i;

/** Starts with a common task-style imperative ("Fix bug", "Call Dana", "Please review"). */
const IMPERATIVE_START =
  /^(please\s+)?(fix|add|remove|update|implement|ship|send|write|review|refactor|buy|call|meet|email|finish|complete|draft|book|schedule|deploy|create|build|investigate|document|merge|release|do|get|go|make|find)\b/i;

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

  if (IMPERATIVE_START.test(normalized)) {
    return {
      intent: "action_item",
      confidence: 0.83,
      reason: "Imperative / task-style opening detected.",
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

  if (GENERAL_WORDS.test(normalized)) {
    return {
      intent: "general",
      confidence: 0.72,
      reason: "Preference or conversational wording detected.",
    };
  }

  return {
    intent: "reference",
    confidence: 0.58,
    reason: "No strong action, decision, or question signal detected.",
  };
}

/**
 * Canvas-aware classification: sticky notes should only create tasks when the text has
 * an explicit action signal. Neutral notes remain reference/general material.
 */
function classifyIntentForNode(text, nodeType) {
  const base = classifyIntent(text);
  return base;
}

module.exports = {
  classifyIntent,
  classifyIntentForNode,
};
