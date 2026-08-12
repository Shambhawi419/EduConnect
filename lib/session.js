import RefreshToken from '@/models/RefreshToken';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from './jwt';
import { setAuthCookies } from './cookies';

export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Issues a fresh access + refresh token pair, persists the refresh token's hash
 * so it can be revoked later, and writes both as httpOnly cookies on `res`.
 */
export async function issueSession(res, user, request) {
  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: request?.headers.get('user-agent') || undefined,
    ip: request?.headers.get('x-forwarded-for')?.split(',')[0].trim() || undefined,
  });

  setAuthCookies(res, { accessToken, refreshToken });
  return res;
}
