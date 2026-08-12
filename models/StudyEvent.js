import mongoose from 'mongoose';

const studyEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 300 },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60, min: 5, max: 600 },
    room: { type: String, trim: true, maxlength: 20 },
    points: { type: Number, min: 0, max: 1000 },
    tone: { type: String, enum: ['rose', 'lav', 'mint'], default: 'lav' },
  },
  { timestamps: true }
);

// Every query is scoped to a single user's day, so index the pair.
studyEventSchema.index({ user: 1, startsAt: 1 });

export default mongoose.models.StudyEvent || mongoose.model('StudyEvent', studyEventSchema);
