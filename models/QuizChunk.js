import mongoose from 'mongoose';
import { RETENTION_MS } from './QuizDocument';

// One row per passage of a PDF: its text plus the embedding used to find it.
const quizChunkSchema = new mongoose.Schema({
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuizDocument',
    required: true,
    index: true,
  },
  // Repeated here so every query can be scoped to the owner without a join.
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Position of the passage within its document (reading order).
  index: { type: Number, required: true },
  // Page the passage starts on.
  page: { type: Number, default: 1 },
  text: { type: String, required: true },
  // The embedding as raw little-endian float32 bytes. A Buffer is about 4x
  // smaller than storing the numbers as a BSON array.
  embedding: { type: Buffer, required: true },
  expiresAt: { type: Date, default: () => new Date(Date.now() + RETENTION_MS) },
});

quizChunkSchema.index({ document: 1, index: 1 });
quizChunkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.QuizChunk || mongoose.model('QuizChunk', quizChunkSchema);
