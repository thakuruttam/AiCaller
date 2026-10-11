import { FAQS } from '../config/faq.js';
import { runChat, hasCredentials } from '../services/chatbot.service.js';

// GET /api/chatbot/faq
export function getFaq(_req, res) {
  res.json(FAQS);
}

// POST /api/chatbot/message
export async function postMessage(req, res) {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) return res.status(400).json({ error: 'message is required' });
  if (message.length > 2000) return res.status(400).json({ error: 'message is too long' });

  if (!hasCredentials()) {
    return res.status(503).json({ error: 'The assistant is not configured on this server.', code: 'CHATBOT_UNAVAILABLE' });
  }

  try {
    const reply = await runChat({ message, history: req.body?.history, user: req.user });
    res.json({ reply, remaining: req.chatRateLimitRemaining || null });
  } catch (err) {
    console.error('[chatbot] postMessage error:', err);
    if (err.code === 'CHATBOT_UNAVAILABLE') {
      return res.status(503).json({ error: err.message, code: 'CHATBOT_UNAVAILABLE' });
    }
    res.status(502).json({ error: 'The assistant is temporarily unavailable. Try again shortly.' });
  }
}
