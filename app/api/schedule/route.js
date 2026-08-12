import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import StudyEvent from '@/models/StudyEvent';
import { requireAuth } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { publicEvent, parseEventBody } from '@/lib/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/schedule?date=YYYY-MM-DD — one day's events for the signed-in user.
export async function GET(request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const date = request.nextUrl.searchParams.get('date');
    const filter = { user: user._id };

    if (date) {
      const dayStart = new Date(`${date}T00:00:00`);
      if (Number.isNaN(dayStart.getTime())) {
        return NextResponse.json({ message: 'Invalid date' }, { status: 400 });
      }
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      filter.startsAt = { $gte: dayStart, $lt: dayEnd };
    }

    await connectDB();
    const events = await StudyEvent.find(filter).sort({ startsAt: 1 });
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
