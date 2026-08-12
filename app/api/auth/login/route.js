import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { publicUser } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { authRateLimit } from '@/lib/rateLimit';
import { issueSession } from '@/lib/session';
import { signMfaPendingToken } from '@/lib/jwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  try {
    const { email, password } = await request.json();

    const limited = authRateLimit(request, typeof email === 'string' ? email : '');
    if (limited) return limited;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ message: 'email and password are required' }, { status: 400 });
    }

    await connectDB();

    const normalizedEmail = validator.normalizeEmail(email) || email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+mfaSecret +failedLoginAttempts +lockUntil +tokenVersion'
    );
    if (!user) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    // Database-backed lockout — this is the authoritative brute-force defence,
    // since in-memory rate limiting can't be trusted across serverless instances.
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return NextResponse.json(
        {
          message: `Account temporarily locked due to failed login attempts. Try again in ${minutesLeft} minute(s).`,
        },
        { status: 423 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    if (user.mfaEnabled) {
      return NextResponse.json({ mfaRequired: true, mfaToken: signMfaPendingToken(user) });
    }

    const res = NextResponse.json({ user: publicUser(user) });
    await issueSession(res, user, request);
    return res;
  } catch (err) {
    console.error('login failed:', err);
    return NextResponse.json({ message: 'Login failed' }, { status: 500 });
  }
}
