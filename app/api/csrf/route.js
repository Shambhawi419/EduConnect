import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CSRF_COOKIE, setCsrfCookie } from '@/lib/cookies';
import { generateCsrfToken } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await cookies();
  let token = store.get(CSRF_COOKIE)?.value;

  const res = NextResponse.json({ csrfToken: null });

  if (!token) {
    token = generateCsrfToken();
    setCsrfCookie(res, token);
  }

  // Returned in the body as well as the cookie so the client can hold it in
  // memory rather than reading document.cookie.
  return NextResponse.json({ csrfToken: token }, { headers: res.headers });
}
