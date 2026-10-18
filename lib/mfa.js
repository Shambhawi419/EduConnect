import speakeasy from 'speakeasy';

const MAX_FAILED_CODES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Checks a TOTP code and tracks wrong guesses on the user document, so a 6-digit
 * code can't be brute-forced. The counters live in MongoDB and are separate from
 * the password lockout (a correct password must not reset them).
 *
 * The user must have been loaded with
 *   .select('+mfaSecret +mfaFailedAttempts +mfaLockUntil')
 *
 * Returns { ok: true } | { ok: false, locked: true, minutesLeft } | { ok: false, locked: false }
 */
export async function checkMfaCode(user, code) {
  if (user.mfaLockUntil && user.mfaLockUntil > Date.now()) {
    return {
      ok: false,
      locked: true,
      minutesLeft: Math.ceil((user.mfaLockUntil - Date.now()) / 60000),
    };
  }

  const token = typeof code === 'string' ? code.trim() : '';
  const valid =
    /^\d{6}$/.test(token) &&
    speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

  if (valid) {
    if (user.mfaFailedAttempts || user.mfaLockUntil) {
      user.mfaFailedAttempts = 0;
      user.mfaLockUntil = undefined;
      await user.save();
    }
    return { ok: true };
  }

  user.mfaFailedAttempts = (user.mfaFailedAttempts || 0) + 1;
  if (user.mfaFailedAttempts >= MAX_FAILED_CODES) {
    user.mfaLockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    user.mfaFailedAttempts = 0;
  }
  await user.save();
  return { ok: false, locked: false };
}

export function lockedMessage(minutesLeft) {
  return `Too many incorrect codes. Try again in ${minutesLeft} minute(s).`;
}
