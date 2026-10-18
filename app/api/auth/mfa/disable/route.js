import { NextResponse } from 'next/server';
import { checkMfaCode, lockedMessage } from '@/lib/mfa';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { requireAuth, publicUser } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user: authUser, error } = await requireAuth();
  if (error) return error;

  try {
    const { code } = await request.json();

    await connectDB();
    const user = await User.findById(authUser._id).select(
      '+mfaSecret +mfaFailedAttempts +mfaLockUntil'
    );
    if (!user?.mfaEnabled) {
      return NextResponse.json({ message: 'MFA is not enabled' }, { status: 400 });
    }

    const result = await checkMfaCode(user, code);
    if (result.locked) {
      return NextResponse.json({ message: lockedMessage(result.minutesLeft) }, { status: 423 });
    }
    if (!result.ok) {
      return NextResponse.json({ message: 'Invalid authentication code' }, { status: 401 });
    }

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    await user.save();
    return NextResponse.json({ message: 'MFA disabled', user: publicUser(user) });
  } catch (err) {
    console.error('mfa disable failed:', err);
    return NextResponse.json({ message: 'Failed to disable MFA' }, { status: 500 });
  }
}
