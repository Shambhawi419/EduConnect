import { NextResponse } from 'next/server';
import { connectDB } from './db';
import RateLimit from '@/models/RateLimit';

/**
 * Rate limiting backed by MongoDB, so the counts are shared by every serverless
 * instance (an in-memory Map is per-instance and can be sidestepped on Vercel).
 *
 * If the database call itself fails, the request is allowed through: the route
 * needs the database anyway and will fail on its own, and a limiter outage should
 * not lock every user out.
 */
async function hit(key, windowMs, max) {
  try {
    await connectDB();
    const now = new Date();

    // Live window: just count this request.
    let doc = await RateLimit.findOneAndUpdate(
      { key, resetAt: { $gt: now } },
      { $inc: { count: 1 } },
      { new: true }
    );

    // No live window: start a new one (replacing an expired row if it is still there).
    if (!doc) {
      try {
        doc = await RateLimit.findOneAndUpdate(
          { key },
          { $set: { count: 1, resetAt: new Date(now.getTime() + windowMs) } },
          { new: true, upsert: true }
        );
      } catch (err) {
        // Two requests raced to create the row; the loser just counts itself.
        if (err?.code !== 11000) throw err;
        doc = await RateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
      }
    }

    if (doc && doc.count > max) {
      return { limited: true, retryAfter: Math.max(1, Math.ceil((doc.resetAt - now) / 1000)) };
    }
    return { limited: false };
  } catch (err) {
    console.error('rate limiter unavailable, allowing request:', err);
    return { limited: false };
  }
}

function clientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function tooMany(message, retryAfter) {
  return NextResponse.json(
    { message },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}

/** Tight limit for credential-guessing surfaces. Keyed by IP + email. */
export async function authRateLimit(request, email = '') {
  const key = `auth:${clientIp(request)}:${email.toLowerCase()}`;
  const { limited, retryAfter } = await hit(key, 15 * 60 * 1000, 10);
  return limited ? tooMany('Too many attempts, please try again later', retryAfter) : null;
}

/**
 * Limit for the expensive OpenAI-backed routes. Keyed by user id when given, so
 * one account can't spend unlimited money by rotating IP addresses.
 */
export async function apiRateLimit(request, bucket = 'api', { userId, max = 60, windowMs = 15 * 60 * 1000 } = {}) {
  const key = `${bucket}:${userId ? `u:${userId}` : `ip:${clientIp(request)}`}`;
  const { limited, retryAfter } = await hit(key, windowMs, max);
  return limited ? tooMany('Too many requests, please try again later', retryAfter) : null;
}
