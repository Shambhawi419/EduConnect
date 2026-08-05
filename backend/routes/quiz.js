const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const openai = require('../utils/openaiClient');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are supported'));
    }
    cb(null, true);
  },
});

const QUIZ_PROMPT = `You are a quiz generator for college students. Read the study material
below and produce a multiple-choice quiz that tests understanding of its key concepts.

Respond with ONLY valid JSON (no markdown fences) matching this shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ]
}`;

router.post('/generate', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'A PDF file is required (field name "file")' });
    }

    const numQuestions = Math.min(Math.max(parseInt(req.body.numQuestions, 10) || 5, 1), 20);

    const parsed = await pdfParse(req.file.buffer);
    const text = parsed.text.trim();
    if (!text) {
      return res.status(422).json({ message: 'Could not extract any text from this PDF' });
    }

    const truncated = text.slice(0, 12000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: QUIZ_PROMPT },
        {
          role: 'user',
          content: `Generate exactly ${numQuestions} questions from this material:\n\n${truncated}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    let quiz;
    try {
      quiz = JSON.parse(raw);
    } catch {
      return res.status(502).json({ message: 'Quiz generation returned malformed data' });
    }

    await User.updateOne({ _id: req.user._id }, { $inc: { 'stats.quizzesGenerated': 1 } });
    res.json({ quiz, sourcePages: parsed.numpages });
  } catch (err) {
    res.status(500).json({ message: 'Quiz generation failed', error: err.message });
  }
});

module.exports = router;
