const express = require('express');
const config = require('../config');
const intentService = require('../services/intent.service');
const { authenticateRequest } = require('../middleware/auth');

const router = express.Router();

// All AI routes require authentication
router.use(authenticateRequest);

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
      console.log(`[AI Proxy] AI service success: intent=${data.intent}, status=${data.status}`);
      return res.json({
        intent: data.intent,
        status: data.status,
        source: 'ai'
      });
    } else {
      console.warn(`[AI Proxy] AI service returned ${response.status}. Falling back to local.`);
    }
  } catch (error) {
    console.warn(`[AI Proxy] AI service unreachable or timed out: ${error.message}. Falling back to local.`);
  }

  // 2. Fallback to local regex-based intent service
  const localResult = intentService.classifyIntentForNode(message, nodeType || 'note');
  console.log(`[AI Proxy] Local fallback: intent=${localResult.intent}`);
  
  return res.json({
    intent: localResult.intent,
    status: 'todo',
    source: 'local'
  });
});

module.exports = router;
