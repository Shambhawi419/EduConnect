import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { CSRF_COOKIE } from './cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit cookie check. Same-origin + SameSite=Lax already blocks most
 * CSRF now that the app is one deployment; this is defence in depth for the
 * cases Lax doesn't cover (e.g. top-level form POSTs from another site).
 *
 * Returns a 403 Response on failure, or null to continue.
 */
export async function requireCsrf(request) {
  if (SAFE_METHODS.has(request.method)) return null;

  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get('x-csrf-token');

  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return NextResponse.json({ message: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  return null;
}

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}
