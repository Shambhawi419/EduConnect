import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { publicUser } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { authRateLimit } from '@/lib/rateLimit';
import { checkMfaCode, lockedMessage } from '@/lib/mfa';
import { verifyAccessToken } from '@/lib/jwt';
import { issueSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const limited = await authRateLimit(request, 'mfa');
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
    const user = await User.findById(payload.sub).select(
      '+mfaSecret +tokenVersion +mfaFailedAttempts +mfaLockUntil'
    );
    if (!user?.mfaEnabled) {
      return NextResponse.json(
        { message: 'MFA is not enabled for this account' },
        { status: 400 }
      );
    }

    // Wrong codes are counted in MongoDB and lock the account's MFA after 5 misses,
    // so the 6-digit code can't be brute-forced across serverless instances.
    const result = await checkMfaCode(user, code);
    if (result.locked) {
      return NextResponse.json({ message: lockedMessage(result.minutesLeft) }, { status: 423 });
    }
    if (!result.ok) {
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
