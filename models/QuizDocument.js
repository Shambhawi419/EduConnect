import mongoose from 'mongoose';

// How long an uploaded PDF (and its indexed chunks) is kept before MongoDB
// deletes it automatically.
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// One row per uploaded PDF. The searchable text lives in QuizChunk.
const quizDocumentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    filename: { type: String, required: true, trim: true, maxlength: 200 },
    pages: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    expiresAt: { type: Date, default: () => new Date(Date.now() + RETENTION_MS) },
  },
  { timestamps: true }
);

quizDocumentSchema.index({ user: 1, createdAt: -1 });
quizDocumentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.QuizDocument || mongoose.model('QuizDocument', quizDocumentSchema);
