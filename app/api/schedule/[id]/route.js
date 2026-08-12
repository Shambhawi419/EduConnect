import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import StudyEvent from '@/models/StudyEvent';
import { requireAuth } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { publicEvent, parseEventBody } from '@/lib/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Every query below filters on `user`, so one account can never read or mutate
// another's events even if it guesses a valid event id.
export async function PATCH(request, { params }) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    const { error: invalid, data } = parseEventBody(await request.json());
    if (invalid) return NextResponse.json({ message: invalid }, { status: 400 });

    await connectDB();
    const event = await StudyEvent.findOneAndUpdate({ _id: id, user: user._id }, data, {
      new: true,
      runValidators: true,
    });
    if (!event) return NextResponse.json({ message: 'Event not found' }, { status: 404 });

    return NextResponse.json({ event: publicEvent(event) });
  } catch (err) {
    console.error('schedule update failed:', err);
    return NextResponse.json({ message: 'Could not update that event' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    await connectDB();
    const event = await StudyEvent.findOneAndDelete({ _id: id, user: user._id });
    if (!event) return NextResponse.json({ message: 'Event not found' }, { status: 404 });

    return NextResponse.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('schedule delete failed:', err);
    return NextResponse.json({ message: 'Could not delete that event' }, { status: 500 });
  }
}
