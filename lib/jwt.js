import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, tv: user.tokenVersion || 0 },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' }
  );
}

export function signMfaPendingToken(user) {
  return jwt.sign({ sub: user._id.toString(), mfaPending: true }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '5m',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
}

// Refresh tokens are opaque random values, not JWTs: no claims to forge, and the
// server is the only party that can map one back to a session (via its hash).
export function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
