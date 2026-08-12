import { NextResponse } from 'next/server';
import speakeasy from 'speakeasy';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { publicUser } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { authRateLimit } from '@/lib/rateLimit';
import { verifyAccessToken } from '@/lib/jwt';
import { issueSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const limited = authRateLimit(request, 'mfa');
  if (limited) return limited;

  try {
    const { mfaToken, code } = await request.json();
    if (!mfaToken || !code) {
      return NextResponse.json({ message: 'mfaToken and code are required' }, { status: 400 });
    }

    let payload;
    try {
      payload = verifyAccessToken(mfaToken);
    } catch {
      return NextResponse.json(
        { message: 'MFA session expired, please log in again' },
        { status: 401 }
      );
    }
    if (!payload.mfaPending) {
      return NextResponse.json({ message: 'Invalid MFA session' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(payload.sub).select('+mfaSecret +tokenVersion');
    if (!user?.mfaEnabled) {
      return NextResponse.json(
        { message: 'MFA is not enabled for this account' },
        { status: 400 }
      );
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!verified) {
      return NextResponse.json({ message: 'Invalid authentication code' }, { status: 401 });
    }

    const res = NextResponse.json({ user: publicUser(user) });
    await issueSession(res, user, request);
    return res;
  } catch (err) {
    console.error('mfa verify failed:', err);
    return NextResponse.json({ message: 'MFA verification failed' }, { status: 500 });
  }
}
