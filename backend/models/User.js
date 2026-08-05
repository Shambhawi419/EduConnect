const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },
    stats: {
      chatMessages: { type: Number, default: 0 },
      quizzesGenerated: { type: Number, default: 0 },
    },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    // Bumped on password change / "log out everywhere" so previously issued access tokens
    // (which embed the tokenVersion they were signed with) stop verifying immediately.
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
