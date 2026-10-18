import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { connectDB } from './db';
import User from '@/models/User';
import { verifyAccessToken } from './jwt';
import { ACCESS_COOKIE } from './cookies';

// Express had `requireAuth` as middleware in a chain. Next route handlers have no
// chain, so this is a helper each protected handler calls first.
export async function getAuthUser() {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);
    // The short-lived MFA "password passed, code pending" token is signed with the
    // same secret; it must never work as a session.
    if (payload.mfaPending) return null;
    await connectDB();
    const user = await User.findById(payload.sub).select('+tokenVersion');
    if (!user) return null;
    // If the password changed or "log out everywhere" ran since this token was
    // issued, tokenVersion has moved on and the token is dead on arrival.
    if ((user.tokenVersion || 0) !== payload.tv) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Usage in a route handler:
 *   const { user, error } = await requireAuth();
 *   if (error) return error;
 */
export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) {
    return {
      error: NextResponse.json({ message: 'Missing or invalid authentication' }, { status: 401 }),
    };
  }
  return { user };
}

export async function requireRole(...allowedRoles) {
  const { user, error } = await requireAuth();
  if (error) return { error };
  if (!allowedRoles.includes(user.role)) {
    return {
      error: NextResponse.json(
        { message: 'Insufficient permissions for this action' },
        { status: 403 }
      ),
    };
  }
  return { user };
}

export function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    stats: {
      chatMessages: user.stats?.chatMessages || 0,
      quizzesGenerated: user.stats?.quizzesGenerated || 0,
    },
  };
}
