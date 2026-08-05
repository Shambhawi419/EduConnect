const express = require('express');
const openai = require('../utils/openaiClient');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const SYSTEM_PROMPT =
  'You are EduConnect, a patient and encouraging tutor for college students. ' +
  'Resolve academic doubts clearly, use step-by-step explanations, and ask a ' +
  'clarifying question if the request is ambiguous. Keep answers focused and concise.';

router.post('/', requireAuth, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'message is required' });
    }

    const priorMessages = Array.isArray(history)
      ? history
          .filter((m) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
          .slice(-10)
      : [];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...priorMessages,
        { role: 'user', content: message },
      ],
      temperature: 0.4,
    });

    const reply = completion.choices[0]?.message?.content ?? '';
    await User.updateOne({ _id: req.user._id }, { $inc: { 'stats.chatMessages': 1 } });
    res.json({ reply });
  } catch (err) {
    res.status(502).json({ message: 'Chatbot request failed', error: err.message });
  }
});

module.exports = router;
