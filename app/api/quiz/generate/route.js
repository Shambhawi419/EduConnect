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

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  const limited = apiRateLimit(request, 'quiz');
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
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ message: 'Only PDF files are supported' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: 'PDF must be smaller than 15MB' }, { status: 413 });
    }

    const numQuestions = Math.min(
      Math.max(parseInt(formData.get('numQuestions'), 10) || 5, 1),
      20
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdf(buffer);
    const text = parsed.text.trim();
    if (!text) {
      return NextResponse.json(
        { message: 'Could not extract any text from this PDF' },
        { status: 422 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: QUIZ_PROMPT },
        {
          role: 'user',
          content: `Generate exactly ${numQuestions} questions from this material:\n\n${text.slice(0, 12000)}`,
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

    // The model sometimes returns correctIndex as a string ("2"). Coerce here so
    // every client gets a consistent shape and strict comparisons work.
    const questions = (quiz.questions ?? []).map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: Number(q.correctIndex),
    }));

    await connectDB();
    await User.updateOne({ _id: user._id }, { $inc: { 'stats.quizzesGenerated': 1 } });

    return NextResponse.json({ quiz: { questions }, sourcePages: parsed.numpages });
  } catch (err) {
    console.error('quiz generation failed:', err);
    return NextResponse.json(
      { message: 'Quiz generation failed', error: err.message },
      { status: 500 }
    );
  }
}
