import { NextResponse } from 'next/server';
import speakeasy from 'speakeasy';
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
    const user = await User.findById(authUser._id).select('+mfaSecret');
    if (!user?.mfaSecret) {
      return NextResponse.json({ message: 'Run MFA setup first' }, { status: 400 });
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

    user.mfaEnabled = true;
    await user.save();
    return NextResponse.json({ message: 'MFA enabled', user: publicUser(user) });
  } catch (err) {
    console.error('mfa enable failed:', err);
    return NextResponse.json({ message: 'Failed to enable MFA' }, { status: 500 });
  }
}
