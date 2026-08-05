const ACCESS_COOKIE = 'ec_access';
const REFRESH_COOKIE = 'ec_refresh';
const CSRF_COOKIE = 'ec_csrf';

// When the frontend and API sit on different domains (Cloudflare Pages calling a
// Render-hosted API), the browser treats every request as cross-site and will drop
// SameSite=Lax cookies. SameSite=None is required there — and browsers only accept
// None over HTTPS, so it implies Secure.
const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
const secure = process.env.COOKIE_SECURE === 'true' || sameSite === 'none';

if (sameSite === 'none' && process.env.COOKIE_SECURE !== 'true') {
  console.warn('COOKIE_SAMESITE=none requires secure cookies — forcing Secure on.');
}

const baseOptions = {
  httpOnly: true,
  secure,
  sameSite,
};

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions,
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
  // Scoped to /api/auth so it's never sent on unrelated API calls.
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions, path: '/api/auth' });
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  cookieSameSite: sameSite,
  cookieSecure: secure,
};
