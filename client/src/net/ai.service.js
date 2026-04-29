import { apiFetch } from './api';

function normalizeTaskStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase();
  if (status === 'doing') return 'in_progress';
  if (status === 'in_progress' || status === 'todo' || status === 'done') {
    return status;
  }
  return 'todo';
}

/**
 * Classify the intent of a text statement using the AI Chatbot via Server Proxy.
 * @param {string} text - The text to analyze.
 * @returns {Promise<object>} - The detected intent and status.
 */
export async function classifyIntent(text) {
  try {
    const data = await apiFetch('/api/ai/classify', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    });

    return {
      intent: data.intent || 'general',
      status: normalizeTaskStatus(data.status)
    };
  } catch (err) {
    console.error('[AI Service] Classification failed:', err);
    return { intent: 'general', status: 'todo' };
  }
}
