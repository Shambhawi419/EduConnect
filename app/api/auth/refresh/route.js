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

// If a token was rotated this recently, a second request carrying it is almost
// certainly the same browser (two tabs, or parallel requests) racing itself, not
// a thief. We refuse it without revoking anything.
const ROTATION_GRACE_MS = 10 * 1000;

function sessionExpired() {
  const res = NextResponse.json(
    { message: 'Session expired, please log in again' },
    { status: 401 }
  );
  clearAuthCookies(res);
  return res;
}

// 409 tells the client "someone else just refreshed — retry with the new cookies".
function refreshRace() {
  return NextResponse.json({ message: 'Session was just refreshed, retry' }, { status: 409 });
}

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

    const stored = await RefreshToken.findOne({ tokenHash: hashRefreshToken(token) });
    if (!stored || stored.expiresAt < new Date()) {
      return sessionExpired();
    }

    if (stored.revoked) {
      const justRotated =
        stored.replacedByHash && Date.now() - stored.updatedAt.getTime() < ROTATION_GRACE_MS;
      if (justRotated) return refreshRace();

      // Reuse of an old rotated token is a strong signal of theft: kill every
      // session for that user rather than trusting either token.
      await RefreshToken.updateMany({ user: stored.user, revoked: false }, { revoked: true });
      await User.findByIdAndUpdate(stored.user, { $inc: { tokenVersion: 1 } });
      return sessionExpired();
    }

    const user = await User.findById(stored.user).select('+tokenVersion');
    if (!user) {
      const res = NextResponse.json({ message: 'User no longer exists' }, { status: 401 });
      clearAuthCookies(res);
      return res;
    }

    // Claim the token atomically. If two requests arrive together, exactly one
    // flips revoked false -> true; the other gets null and backs off.
    const newRefreshToken = generateRefreshToken();
    const newHash = hashRefreshToken(newRefreshToken);
    const claimed = await RefreshToken.findOneAndUpdate(
      { _id: stored._id, revoked: false },
      { revoked: true, replacedByHash: newHash }
    );
    if (!claimed) return refreshRace();

    await RefreshToken.create({
      user: user._id,
      tokenHash: newHash,
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
