/**
 * AI Service for interacting with the FastAPI chatbot backend.
 */

const CHATBOT_URL = 'http://localhost:8000';

function normalizeTaskStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase();
  if (status === 'doing') return 'in_progress';
  if (status === 'in_progress' || status === 'todo' || status === 'done') {
    return status;
  }
  return 'todo';
}

/**
 * Classify the intent of a text statement using the AI Chatbot.
 * @param {string} text - The text to analyze.
 * @returns {Promise<string>} - The detected intent/class.
 */
export async function classifyIntent(text) {
  try {
    const response = await fetch(`${CHATBOT_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chatbot API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      intent: data.intent || 'general',
      status: normalizeTaskStatus(data.status)
    };
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      console.warn('[AI Service] Chatbot backend is unreachable. Please ensure the Python service is running on port 8000.');
    } else {
      console.error('[AI Service] Classification failed:', err);
    }
    return { intent: 'general', status: 'todo' };
  }
}
