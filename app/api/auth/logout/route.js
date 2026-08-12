import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import RefreshToken from '@/models/RefreshToken';
import { requireCsrf } from '@/lib/csrf';
import { REFRESH_COOKIE, clearAuthCookies } from '@/lib/cookies';
import { hashRefreshToken } from '@/lib/jwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  try {
    const store = await cookies();
    const token = store.get(REFRESH_COOKIE)?.value;
    if (token) {
      await connectDB();
      await RefreshToken.updateOne({ tokenHash: hashRefreshToken(token) }, { revoked: true });
    }
  } catch (err) {
    console.error('logout cleanup failed:', err);
    // Still clear cookies below — the client should end up logged out regardless.
  }

  const res = NextResponse.json({ message: 'Logged out' });
  clearAuthCookies(res);
  return res;
}
