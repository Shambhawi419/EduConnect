import { NextResponse } from 'next/server';
import openai from '@/lib/openai';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { apiRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_MESSAGE_CHARS = 4000;

const SYSTEM_PROMPT =
  'You are EduConnect, a patient and encouraging tutor for college students. ' +
  'Resolve academic doubts clearly, use step-by-step explanations, and ask a ' +
  'clarifying question if the request is ambiguous. Keep answers focused and concise.';

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  const limited = await apiRateLimit(request, 'chatbot', { userId: user._id.toString() });
  if (limited) return limited;

  try {
    const { message, history } = await request.json();
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ message: 'message is required' }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { message: `Message must be ${MAX_MESSAGE_CHARS} characters or fewer` },
        { status: 400 }
      );
    }

    const priorMessages = Array.isArray(history)
      ? history
          .filter(
            (m) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role)
          )
          .slice(-10)
          // Cap each past message too, so the history can't be used to inflate the
          // prompt (and the bill) beyond what a normal conversation would cost.
          .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
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

    await connectDB();
    await User.updateOne({ _id: user._id }, { $inc: { 'stats.chatMessages': 1 } });

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('chatbot failed:', err);
    // err.message can contain provider internals; the details stay in the server log.
    return NextResponse.json({ message: 'Chatbot request failed' }, { status: 502 });
  }
}
