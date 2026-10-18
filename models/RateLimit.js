import mongoose from 'mongoose';

// One row per rate-limit bucket (e.g. "auth:1.2.3.4:a@b.com" or "chatbot:<userId>").
// Stored in MongoDB rather than process memory so every serverless instance sees
// the same counts.
const rateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  resetAt: { type: Date, required: true },
});

// MongoDB deletes the row once the window has ended.
rateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RateLimit || mongoose.model('RateLimit', rateLimitSchema);
