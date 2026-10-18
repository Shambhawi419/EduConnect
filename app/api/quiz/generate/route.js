import { NextResponse } from 'next/server';
// Import the library entry point directly — the package index runs a debug
// harness that reads a sample PDF from disk at import time, which breaks bundling.
import pdf from 'pdf-parse/lib/pdf-parse.js';
import openai from '@/lib/openai';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { apiRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;
// How much PDF text we send to the model, and how many windows it is split into
// when the document is longer than that.
const MAX_CHARS = 12000;
const SAMPLE_WINDOWS = 4;

const QUIZ_PROMPT = `You are a quiz generator for college students. Read the study material
below and produce a multiple-choice quiz that tests understanding of its key concepts.
If the material is shown as several excerpts separated by "[...]", spread the questions
across all of the excerpts.

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

// Long documents used to be cut off after the first 12,000 characters, so the quiz
// only covered the opening pages. Instead take evenly spaced windows across the
// whole text so every part of the document can contribute questions.
function sampleText(text) {
  if (text.length <= MAX_CHARS) return { text, truncated: false };

  const windowSize = Math.floor(MAX_CHARS / SAMPLE_WINDOWS);
  const lastStart = text.length - windowSize;
  const parts = [];
  for (let i = 0; i < SAMPLE_WINDOWS; i += 1) {
    const start = Math.round((lastStart * i) / (SAMPLE_WINDOWS - 1));
    parts.push(text.slice(start, start + windowSize));
  }
  return { text: parts.join('\n\n[...]\n\n'), truncated: true };
}

// The model's JSON is untrusted: keep only questions that are well-formed and whose
// correctIndex really points at one of the options.
function cleanQuestions(raw, limit) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q) => ({
      question: typeof q?.question === 'string' ? q.question.trim() : '',
      options: Array.isArray(q?.options) ? q.options : [],
      // The model sometimes returns correctIndex as a string ("2").
      correctIndex: Number(q?.correctIndex),
      explanation: typeof q?.explanation === 'string' ? q.explanation.trim() : '',
    }))
    .filter(
      (q) =>
        q.question &&
        q.options.length >= 2 &&
        q.options.every((o) => typeof o === 'string' && o.trim()) &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < q.options.length
    )
    .map((q) => ({ ...q, options: q.options.map((o) => o.trim()) }))
    .slice(0, limit);
}

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  // Quizzes are the most expensive call in the app, so they get a tighter limit.
  const limited = await apiRateLimit(request, 'quiz', {
    userId: user._id.toString(),
    max: 10,
  });
  if (limited) return limited;

  try {
    // Replaces multer — the web FormData API is built into route handlers.
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { message: 'A PDF file is required (field name "file")' },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: 'PDF must be smaller than 15MB' }, { status: 413 });
    }

    const numQuestions = Math.min(
      Math.max(parseInt(formData.get('numQuestions'), 10) || 5, 1),
      20
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    // file.type is whatever the client claims; check the file's own signature too.
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return NextResponse.json({ message: 'Only PDF files are supported' }, { status: 400 });
    }

    let parsed;
    try {
      parsed = await pdf(buffer);
    } catch (err) {
      console.error('pdf parse failed:', err);
      return NextResponse.json({ message: 'Could not read this PDF' }, { status: 422 });
    }
    const fullText = parsed.text.trim();
    if (!fullText) {
      return NextResponse.json(
        { message: 'Could not extract any text from this PDF' },
        { status: 422 }
      );
    }

    const { text, truncated } = sampleText(fullText);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: QUIZ_PROMPT },
        {
          role: 'user',
          content: `Generate exactly ${numQuestions} questions from this material:\n\n${text}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    let quiz;
    try {
      quiz = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
    } catch {
      return NextResponse.json({ message: 'Quiz generation returned malformed data' }, { status: 502 });
    }

    const questions = cleanQuestions(quiz.questions, numQuestions);
    if (questions.length === 0) {
      return NextResponse.json(
        { message: 'Quiz generation returned no usable questions, please try again' },
        { status: 502 }
      );
    }

    await connectDB();
    await User.updateOne({ _id: user._id }, { $inc: { 'stats.quizzesGenerated': 1 } });

    return NextResponse.json({
      quiz: { questions },
      sourcePages: parsed.numpages,
      // True when the PDF was too long to send in full and was sampled instead.
      truncated,
    });
  } catch (err) {
    console.error('quiz generation failed:', err);
    // err.message can contain provider internals; the details stay in the server log.
    return NextResponse.json({ message: 'Quiz generation failed' }, { status: 500 });
  }
}
