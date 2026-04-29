const express = require('express');
const aiClassifier = require('../services/ai-classifier.service');
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

  const classification = await aiClassifier.classifyIntent(message, {
    nodeType,
    logPrefix: '[AI Proxy]',
  });
  return res.json(classification);
});

module.exports = router;
