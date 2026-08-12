import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import RefreshToken from '@/models/RefreshToken';
import { requireAuth } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { clearAuthCookies } from '@/lib/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  const { user, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  await RefreshToken.updateMany({ user: user._id, revoked: false }, { revoked: true });
  // Bumping tokenVersion invalidates every already-issued access token too.
  await User.findByIdAndUpdate(user._id, { $inc: { tokenVersion: 1 } });

  const res = NextResponse.json({ message: 'Logged out of all devices' });
  clearAuthCookies(res);
  return res;
}
