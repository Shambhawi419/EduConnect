import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import validator from 'validator';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { publicUser } from '@/lib/auth';
import { requireCsrf } from '@/lib/csrf';
import { authRateLimit } from '@/lib/rateLimit';
import { issueSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isStrongPassword(password) {
  return (
    typeof password === 'string' &&
    validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
  );
}

export async function POST(request) {
  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const { name, email, password } = body;

    const limited = await authRateLimit(request, typeof email === 'string' ? email : '');
    if (limited) return limited;

    if (!name || typeof name !== 'string' || !email || typeof email !== 'string' || !password) {
      return NextResponse.json({ message: 'name, email and password are required' }, { status: 400 });
    }
    if (!validator.isEmail(email)) {
      return NextResponse.json({ message: 'Enter a valid email address' }, { status: 400 });
    }
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          message:
            'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a symbol',
        },
        { status: 400 }
      );
    }

    await connectDB();

    const normalizedEmail = validator.normalizeEmail(email) || email.toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json(
        { message: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // Self-registration always creates a student. A request-supplied role is
    // ignored; admins are promoted out-of-band with `npm run make-admin`.
    const user = await User.create({
      name: validator.escape(name.trim()),
      email: normalizedEmail,
      passwordHash,
      role: 'student',
    });

    const res = NextResponse.json({ user: publicUser(user) }, { status: 201 });
    await issueSession(res, user, request);
    return res;
  } catch (err) {
    // Two simultaneous sign-ups with the same email: the unique index rejects the second.
    if (err?.code === 11000) {
      return NextResponse.json(
        { message: 'An account with this email already exists' },
        { status: 409 }
      );
    }
    console.error('register failed:', err);
    return NextResponse.json({ message: 'Registration failed' }, { status: 500 });
  }
}
