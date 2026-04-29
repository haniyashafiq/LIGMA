const express = require('express');
const config = require('../config');
const intentService = require('../services/intent.service');
const { authenticateRequest } = require('../middleware/auth');

const router = express.Router();
const VALID_AI_INTENTS = new Set([
  'action_item',
  'decision',
  'open_question',
  'reference',
  'general',
]);
const VALID_TASK_STATUSES = new Set(['todo', 'in_progress', 'done']);

// All AI routes require authentication
router.use(authenticateRequest);

function normalizeIntent(rawIntent) {
  const intent = String(rawIntent || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (intent === 'action') return 'action_item';
  if (intent === 'question') return 'open_question';

  return VALID_AI_INTENTS.has(intent) ? intent : null;
}

function normalizeTaskStatus(rawStatus) {
  const status = String(rawStatus || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (status === 'doing') return 'in_progress';

  return VALID_TASK_STATUSES.has(status) ? status : 'todo';
}

function localClassification(message, nodeType) {
  const localResult = intentService.classifyIntentForNode(message, nodeType || 'note');
  console.log(`[AI Proxy] Local fallback: intent=${localResult.intent}`);

  return {
    intent: localResult.intent,
    status: 'todo',
    source: 'local',
    confidence: localResult.confidence,
    reason: localResult.reason,
  };
}

/**
 * Proxies or falls back to intent classification.
 * First tries the optional Gemini HTTP service (/ai), then falls back to local rules.
 */
router.post('/classify', async (req, res) => {
  const { message, nodeType } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    console.log(`[AI Proxy] Attempting classification for: "${message.substring(0, 30)}..."`);
    
    const classifyUrl = `${config.AI_SERVICE_URL}/chat`;
    const response = await fetch(classifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(3000) // 3s timeout for AI
    });

    if (response.ok) {
      const data = await response.json();
      const intent = normalizeIntent(data.intent || data.reply);

      if (intent) {
        console.log(`[AI Proxy] AI service success: intent=${intent}, status=${data.status}`);
        return res.json({
          intent,
          status: normalizeTaskStatus(data.status),
          source: 'ai'
        });
      }

      console.warn(`[AI Proxy] AI service returned unusable intent "${data.intent}". Falling back to local.`);
    } else {
      console.warn(`[AI Proxy] AI service returned ${response.status}. Falling back to local.`);
    }
  } catch (error) {
    console.warn(`[AI Proxy] AI service unreachable or timed out: ${error.message}. Falling back to local.`);
  }

  return res.json(localClassification(message, nodeType));
});

module.exports = router;
