import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import StudyEvent from '@/models/StudyEvent';
import { requireAuth } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { publicEvent, parseEventBody } from '@/lib/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_RANGE_MS = 32 * 24 * 60 * 60 * 1000;

// GET /api/schedule?from=<ISO>&to=<ISO> — the signed-in user's events in [from, to).
// The browser sends its own day boundaries as exact instants; computing "midnight"
// here would use the server's timezone (UTC on Vercel) and shift events across days.
export async function GET(request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const params = request.nextUrl.searchParams;
    const filter = { user: user._id };

    if (params.get('from') || params.get('to')) {
      const from = new Date(params.get('from'));
      const to = new Date(params.get('to'));
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
        return NextResponse.json({ message: 'Invalid date range' }, { status: 400 });
      }
      if (to - from > MAX_RANGE_MS) {
        return NextResponse.json({ message: 'Date range is too large' }, { status: 400 });
      }
      filter.startsAt = { $gte: from, $lt: to };
    }

    await connectDB();
    const events = await StudyEvent.find(filter).sort({ startsAt: 1 }).limit(500);
    return NextResponse.json({ events: events.map(publicEvent) });
  } catch (err) {
    console.error('schedule list failed:', err);
    return NextResponse.json({ message: 'Could not load your schedule' }, { status: 500 });
  }
}

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { error: invalid, data } = parseEventBody(await request.json());
    if (invalid) return NextResponse.json({ message: invalid }, { status: 400 });

    await connectDB();
    const event = await StudyEvent.create({ ...data, user: user._id });
    return NextResponse.json({ event: publicEvent(event) }, { status: 201 });
  } catch (err) {
    console.error('schedule create failed:', err);
    return NextResponse.json({ message: 'Could not save that event' }, { status: 500 });
  }
}
