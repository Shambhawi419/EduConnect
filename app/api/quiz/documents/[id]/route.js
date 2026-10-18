import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import QuizDocument from '@/models/QuizDocument';
import QuizChunk from '@/models/QuizChunk';
import { requireAuth } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DELETE /api/quiz/documents/<id> — remove a PDF and all of its indexed passages.
// Both queries filter on `user`, so one account can't delete another's documents.
export async function DELETE(request, { params }) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ message: 'Document not found' }, { status: 404 });
    }

    await connectDB();
    const doc = await QuizDocument.findOneAndDelete({ _id: id, user: user._id });
    if (!doc) return NextResponse.json({ message: 'Document not found' }, { status: 404 });

    await QuizChunk.deleteMany({ document: doc._id, user: user._id });
    return NextResponse.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('quiz document delete failed:', err);
    return NextResponse.json({ message: 'Could not delete that document' }, { status: 500 });
  }
}
