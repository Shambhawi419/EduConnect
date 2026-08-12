import { NextResponse } from 'next/server';

/**
 * Best-effort in-memory rate limiting.
 *
 * IMPORTANT: on Vercel each serverless instance has its own memory, so a
 * distributed attacker spread across cold starts can exceed these limits. This
 * is a speed bump, NOT the primary brute-force defence — that is the
 * database-backed account lockout in the login route, which is authoritative
 * because it lives in MongoDB and every instance sees it.
 *
 * To make this authoritative too, swap the Map for Redis (e.g. Upstash) —
 * the call signature below stays the same.
 */
const store = globalThis._rateLimitStore || (globalThis._rateLimitStore = new Map());

function hit(key, windowMs, max) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  entry.count += 1;
  if (entry.count > max) {
    return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false };
}

// Opportunistically drop expired entries so a long-lived instance doesn't grow
// unboundedly. Cheap because it only runs on writes.
function sweep() {
  if (store.size < 5000) return;
  const now = Date.now();
  for (const [k, v] of store) if (now > v.resetAt) store.delete(k);
}

function clientKey(request, suffix = '') {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return `${ip}:${suffix}`;
}

/** Tight limit for credential-guessing surfaces. Keyed by IP + email. */
export function authRateLimit(request, email = '') {
  sweep();
  const { limited, retryAfter } = hit(clientKey(request, email.toLowerCase()), 15 * 60 * 1000, 10);
  if (!limited) return null;
  return NextResponse.json(
    { message: 'Too many attempts, please try again later' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}

/** Looser limit for the expensive OpenAI-backed routes. */
export function apiRateLimit(request, bucket = 'api') {
  sweep();
  const { limited, retryAfter } = hit(clientKey(request, bucket), 15 * 60 * 1000, 60);
  if (!limited) return null;
  return NextResponse.json(
    { message: 'Too many requests, please try again later' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}
