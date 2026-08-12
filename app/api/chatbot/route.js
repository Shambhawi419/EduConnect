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

const SYSTEM_PROMPT =
  'You are EduConnect, a patient and encouraging tutor for college students. ' +
  'Resolve academic doubts clearly, use step-by-step explanations, and ask a ' +
  'clarifying question if the request is ambiguous. Keep answers focused and concise.';

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  const limited = apiRateLimit(request, 'chatbot');
  if (limited) return limited;

  try {
    const { message, history } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ message: 'message is required' }, { status: 400 });
    }

    const priorMessages = Array.isArray(history)
      ? history
          .filter(
            (m) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role)
          )
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

    await connectDB();
    await User.updateOne({ _id: user._id }, { $inc: { 'stats.chatMessages': 1 } });

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('chatbot failed:', err);
    return NextResponse.json(
      { message: 'Chatbot request failed', error: err.message },
      { status: 502 }
    );
  }
}
