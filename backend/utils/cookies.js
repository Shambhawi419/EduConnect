const ACCESS_COOKIE = 'ec_access';
const REFRESH_COOKIE = 'ec_refresh';
const CSRF_COOKIE = 'ec_csrf';

const secure = process.env.COOKIE_SECURE === 'true';

const baseOptions = {
  httpOnly: true,
  secure,
  sameSite: 'lax',
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
};
