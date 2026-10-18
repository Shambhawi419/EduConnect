import { NextResponse } from 'next/server';
// Import the library entry point directly — the package index runs a debug
// harness that reads a sample PDF from disk at import time, which breaks bundling.
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { connectDB } from '@/lib/db';
import QuizDocument from '@/models/QuizDocument';
import QuizChunk from '@/models/QuizChunk';
import { requireAuth } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { apiRateLimit } from '@/lib/rateLimit';
import { chunkPages, embedTexts, vectorToBuffer } from '@/lib/rag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel rejects request bodies over about 4.5 MB before our code runs, so a
// bigger limit here would only produce a confusing platform error.
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_DOCUMENTS = 5; // per user, to keep storage bounded
const MAX_CHUNKS = 400; // roughly 250 pages of dense text

function publicDocument(doc) {
  return {
    id: doc._id.toString(),
    filename: doc.filename,
    pages: doc.pages,
    chunks: doc.chunkCount,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
  };
}

// Same text extraction pdf-parse does by default, but it also records each page's
// text separately so passages can be traced back to a page number.
function pageCollector() {
  const pages = [];
  const pagerender = async (pageData) => {
    const content = await pageData.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    });
    let lastY;
    let text = '';
    for (const item of content.items) {
      if (lastY === item.transform[5] || !lastY) text += item.str;
      else text += `\n${item.str}`;
      lastY = item.transform[5];
    }
    pages[pageData.pageIndex ?? pageData.pageNumber - 1] = text;
    return text;
  };
  return { pages, pagerender };
}

// GET /api/quiz/documents — the signed-in user's indexed PDFs, newest first.
export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const docs = await QuizDocument.find({ user: user._id }).sort({ createdAt: -1 });
    return NextResponse.json({ documents: docs.map(publicDocument) });
  } catch (err) {
    console.error('quiz documents list failed:', err);
    return NextResponse.json({ message: 'Could not load your documents' }, { status: 500 });
  }
}

// POST /api/quiz/documents — upload a PDF, split it into passages, embed them and store.
export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  const limited = await apiRateLimit(request, 'quiz-upload', {
    userId: user._id.toString(),
    max: 10,
  });
  if (limited) return limited;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { message: 'A PDF file is required (field name "file")' },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: 'PDF must be smaller than 4MB' }, { status: 413 });
    }

    await connectDB();
    // Check the quota before spending anything on embeddings.
    if ((await QuizDocument.countDocuments({ user: user._id })) >= MAX_DOCUMENTS) {
      return NextResponse.json(
        { message: `You can keep ${MAX_DOCUMENTS} documents. Delete one to upload another.` },
        { status: 409 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // file.type is whatever the client claims; check the file's own signature too.
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return NextResponse.json({ message: 'Only PDF files are supported' }, { status: 400 });
    }

    const { pages, pagerender } = pageCollector();
    let parsed;
    try {
      parsed = await pdf(buffer, { pagerender });
    } catch (err) {
      console.error('pdf parse failed:', err);
      return NextResponse.json({ message: 'Could not read this PDF' }, { status: 422 });
    }
    const pageTexts = Array.from({ length: parsed.numpages }, (_, i) => pages[i] || '');

    const chunks = chunkPages(pageTexts);
    if (chunks.length === 0) {
      return NextResponse.json(
        { message: 'Could not extract any text from this PDF (is it a scan?)' },
        { status: 422 }
      );
    }
    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json(
        { message: 'This PDF is too long to index (the limit is about 250 pages of text)' },
        { status: 413 }
      );
    }

    let vectors;
    try {
      vectors = await embedTexts(chunks.map((c) => c.text));
    } catch (err) {
      console.error('embedding failed:', err);
      return NextResponse.json(
        { message: 'Could not index this PDF right now, please try again' },
        { status: 502 }
      );
    }

    const doc = await QuizDocument.create({
      user: user._id,
      filename: (typeof file.name === 'string' && file.name ? file.name : 'document.pdf').slice(0, 200),
      pages: parsed.numpages,
      chunkCount: chunks.length,
    });

    try {
      await QuizChunk.insertMany(
        chunks.map((chunk, i) => ({
          document: doc._id,
          user: user._id,
          index: i,
          page: chunk.page,
          text: chunk.text,
          embedding: vectorToBuffer(vectors[i]),
          expiresAt: doc.expiresAt,
        }))
      );
    } catch (err) {
      // Don't leave a document that has no (or only some) passages.
      await QuizChunk.deleteMany({ document: doc._id });
      await QuizDocument.deleteOne({ _id: doc._id });
      throw err;
    }

    return NextResponse.json({ document: publicDocument(doc) }, { status: 201 });
  } catch (err) {
    console.error('quiz document upload failed:', err);
    return NextResponse.json({ message: 'Could not process that PDF' }, { status: 500 });
  }
}
