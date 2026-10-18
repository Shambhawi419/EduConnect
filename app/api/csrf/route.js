import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CSRF_COOKIE, setCsrfCookie } from '@/lib/cookies';
import { generateCsrfToken } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await cookies();
  const existing = store.get(CSRF_COOKIE)?.value;
  const token = existing || generateCsrfToken();

  // Returned in the body as well as the cookie so the client can hold it in
  // memory rather than reading document.cookie.
  const res = NextResponse.json({ csrfToken: token }, { headers: { 'Cache-Control': 'no-store' } });
  if (!existing) setCsrfCookie(res, token);
  return res;
}
