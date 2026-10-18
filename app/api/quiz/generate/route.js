import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import openai from '@/lib/openai';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import QuizDocument from '@/models/QuizDocument';
import QuizChunk from '@/models/QuizChunk';
import { requireAuth } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { apiRateLimit } from '@/lib/rateLimit';
import { embedTexts, bufferToVector, centroid, selectPassages } from '@/lib/rag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_TOPIC_CHARS = 200;
// Below this similarity nothing in the document is even loosely about the topic,
// so we skip the (paid) generation call.
const TOPIC_FLOOR = 0.12;
// Topic mode keeps a passage only if it is at least this fraction as relevant as
// the best match, so a narrow topic isn't padded out with unrelated passages.
const TOPIC_KEEP_RATIO = 0.6;
// MMR trade-off: higher favours relevance, lower favours variety.
const LAMBDA_TOPIC = 0.75;
const LAMBDA_COVERAGE = 0.35;

const QUIZ_PROMPT = `You write multiple-choice quiz questions for college students from numbered
passages of their own study material.

Rules:
- Use ONLY information stated in the passages. Do not add outside facts.
- Each question must be answerable from a single passage. Set "source" to that passage's number.
- Every passage is labelled with how many questions to write from it. Write exactly that many
  from each, so the quiz covers all of the passages.
- Give exactly four options with one correct answer. "correctIndex" is the 0-based index of
  the correct option. Wrong options must be plausible but clearly wrong according to the passage.
- "explanation" is one or two sentences saying why the answer is correct, based on the passage.
- If a focus topic is given, EVERY question must be about that topic. A passage may also contain
  unrelated material; ignore that material. If the passages do not actually cover the topic,
  or cover it too thinly for the number of questions requested, return fewer questions (or
  {"questions": []}) rather than drifting onto other subjects.

Respond with ONLY valid JSON (no markdown fences) matching this shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string",
      "source": 1
    }
  ]
}`;

const STOP_WORDS = new Set([
  'what', 'which', 'that', 'this', 'with', 'from', 'their', 'there', 'about', 'were', 'have',
  'been', 'does', 'into', 'than', 'then', 'them', 'these', 'those', 'when', 'where', 'while',
  'would', 'could', 'should', 'also', 'such', 'each', 'other', 'more', 'most', 'some', 'only',
  'very', 'your', 'between', 'during',
]);

function contentWords(text) {
  return new Set((text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((w) => !STOP_WORDS.has(w)));
}

// The part of a passage that actually supports a question: the sentence sharing the
// most words with the question, its correct answer and its explanation. (The start of
// a passage is not a good quote — it begins with text overlapping the previous passage.)
function bestExcerpt(passageText, questionText) {
  const flat = passageText.replace(/\s+/g, ' ').trim();
  const sentences = flat.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [flat];
  const wanted = contentWords(questionText);

  let best = 0;
  let bestScore = -1;
  sentences.forEach((sentence, i) => {
    let score = 0;
    for (const word of contentWords(sentence)) if (wanted.has(word)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });

  // Add following sentences while the quote is short, up to about 300 characters.
  let text = sentences[best].trim();
  for (let j = best + 1; j < sentences.length && text.length < 160; j += 1) {
    const next = sentences[j].trim();
    if (text.length + 1 + next.length > 300) break;
    text += ` ${next}`;
  }
  return text.length > 300 ? `${text.slice(0, 300).trimEnd()}…` : text;
}

// The model's JSON is untrusted: keep only questions that are well-formed and whose
// correctIndex really points at one of the options, and attach the passage each one
// came from (looked up from OUR passages, never taken from the model's text).
function cleanQuestions(raw, passages, limit) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q) => ({
      question: typeof q?.question === 'string' ? q.question.trim() : '',
      options: Array.isArray(q?.options) ? q.options : [],
      // The model sometimes returns numbers as strings ("2").
      correctIndex: Number(q?.correctIndex),
      explanation: typeof q?.explanation === 'string' ? q.explanation.trim() : '',
      sourceNumber: Number(q?.source),
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
    .slice(0, limit)
    .map(({ sourceNumber, ...q }) => {
      const passage = Number.isInteger(sourceNumber) ? passages[sourceNumber - 1] : null;
      const options = q.options.map((o) => o.trim());
      return {
        ...q,
        options,
        source: passage
          ? {
              page: passage.page,
              excerpt: bestExcerpt(
                passage.text,
                `${q.question} ${options[q.correctIndex]} ${q.explanation}`
              ),
            }
          : null,
      };
    });
}

// POST /api/quiz/generate  { documentId, topic?, numQuestions }
// Retrieval-augmented generation: find the passages of the document that matter for
// this quiz, then ask the model to write questions from those passages only.
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
    const body = await request.json();
    const { documentId } = body;
    if (!mongoose.isValidObjectId(documentId)) {
      return NextResponse.json({ message: 'Choose a document first' }, { status: 400 });
    }
    const topic =
      typeof body.topic === 'string' ? body.topic.trim().slice(0, MAX_TOPIC_CHARS) : '';
    const numQuestions = Math.min(Math.max(parseInt(body.numQuestions, 10) || 5, 1), 20);

    await connectDB();
    const doc = await QuizDocument.findOne({ _id: documentId, user: user._id });
    if (!doc) return NextResponse.json({ message: 'Document not found' }, { status: 404 });

    const chunks = await QuizChunk.find({ document: doc._id, user: user._id })
      .sort({ index: 1 })
      .select('index page text embedding')
      .lean();
    if (chunks.length === 0) {
      return NextResponse.json({ message: 'This document has no indexed text' }, { status: 404 });
    }
    const vectors = chunks.map((c) => bufferToVector(c.embedding));

    // ---- retrieve ----
    // One passage per question where possible, capped so the prompt stays small.
    const wanted = Math.min(12, numQuestions);
    let picked;
    const mode = topic ? 'topic' : 'coverage';
    if (topic) {
      let queryVec;
      try {
        [queryVec] = await embedTexts([topic]);
      } catch (err) {
        console.error('topic embedding failed:', err);
        return NextResponse.json({ message: 'Could not search the document right now' }, { status: 502 });
      }
      const result = selectPassages(vectors, queryVec, wanted, LAMBDA_TOPIC);
      const best = result.relevance[result.picked[0]];
      if (best < TOPIC_FLOOR) {
        return NextResponse.json(
          { message: `Nothing in this document seems to be about “${topic}”` },
          { status: 422 }
        );
      }
      picked = result.picked.filter((i) => result.relevance[i] >= best * TOPIC_KEEP_RATIO);
    } else {
      // No topic: aim for variety around the document's overall theme, so a long
      // PDF is covered end to end instead of only its first pages.
      picked = selectPassages(vectors, centroid(vectors), wanted, LAMBDA_COVERAGE).picked;
    }
    // Deal the questions out evenly across the passages (any remainder goes to the
    // best-ranked ones). Asking the model to "spread them out" isn't reliable — it
    // tends to pile onto the first couple of passages — so the quota is decided here.
    const chosen = picked.slice(0, numQuestions);
    const base = Math.floor(numQuestions / chosen.length);
    const extra = numQuestions % chosen.length;
    // Present the passages in reading order.
    const passages = chosen
      .map((i, rank) => ({ ...chunks[i], count: base + (rank < extra ? 1 : 0) }))
      .sort((a, b) => a.index - b.index);

    // ---- generate ----
    const context = passages
      .map(
        (p, n) =>
          `[${n + 1}] (page ${p.page}) — write ${p.count} question${p.count === 1 ? '' : 's'} from this passage\n${p.text}`
      )
      .join('\n\n');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: QUIZ_PROMPT },
        {
          role: 'user',
          content:
            `Generate exactly ${numQuestions} questions.` +
            (topic ? `\nFocus topic: ${topic}` : '') +
            `\n\nPassages:\n${context}`,
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

    const questions = cleanQuestions(quiz.questions, passages, numQuestions);
    if (questions.length === 0) {
      return NextResponse.json(
        {
          message: topic
            ? `This document doesn't seem to cover “${topic}” well enough for a quiz`
            : 'Quiz generation returned no usable questions, please try again',
        },
        { status: topic ? 422 : 502 }
      );
    }

    await User.updateOne({ _id: user._id }, { $inc: { 'stats.quizzesGenerated': 1 } });

    return NextResponse.json({
      quiz: { questions },
      document: { id: doc._id.toString(), filename: doc.filename },
      retrieval: {
        mode,
        topic: topic || null,
        passagesUsed: passages.length,
        passagesTotal: chunks.length,
        requested: numQuestions,
        returned: questions.length,
      },
    });
  } catch (err) {
    console.error('quiz generation failed:', err);
    // err.message can contain provider internals; the details stay in the server log.
    return NextResponse.json({ message: 'Quiz generation failed' }, { status: 500 });
  }
}
