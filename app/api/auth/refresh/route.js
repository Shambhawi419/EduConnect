import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import RefreshToken from '@/models/RefreshToken';
import { publicUser } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { REFRESH_COOKIE, setAuthCookies, clearAuthCookies } from '@/lib/cookies';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '@/lib/jwt';
import { REFRESH_TTL_MS } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  try {
    const store = await cookies();
    const token = store.get(REFRESH_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ message: 'Missing refresh token' }, { status: 401 });
    }

    await connectDB();

    const tokenHash = hashRefreshToken(token);
    const stored = await RefreshToken.findOne({ tokenHash });

    // Reuse of a revoked/rotated refresh token is a strong signal of theft: kill
    // every session for that user rather than trusting either token.
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      if (stored && stored.revoked) {
        await RefreshToken.updateMany({ user: stored.user, revoked: false }, { revoked: true });
        await User.findByIdAndUpdate(stored.user, { $inc: { tokenVersion: 1 } });
      }
      const res = NextResponse.json(
        { message: 'Session expired, please log in again' },
        { status: 401 }
      );
      clearAuthCookies(res);
      return res;
    }

    const user = await User.findById(stored.user).select('+tokenVersion');
    if (!user) {
      const res = NextResponse.json({ message: 'User no longer exists' }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    const newRefreshToken = generateRefreshToken();
    stored.revoked = true;
    stored.replacedByHash = hashRefreshToken(newRefreshToken);
    await stored.save();

    await RefreshToken.create({
      user: user._id,
      tokenHash: stored.replacedByHash,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined,
    });

    const res = NextResponse.json({ user: publicUser(user) });
    setAuthCookies(res, { accessToken: signAccessToken(user), refreshToken: newRefreshToken });
    return res;
  } catch (err) {
    console.error('refresh failed:', err);
    return NextResponse.json({ message: 'Could not refresh session' }, { status: 500 });
  }
}
