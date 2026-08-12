export const ACCESS_COOKIE = 'ec_access';
export const REFRESH_COOKIE = 'ec_refresh';
export const CSRF_COOKIE = 'ec_csrf';

const secure = process.env.NODE_ENV === 'production';

// Frontend and API are now the same origin, so SameSite=Lax is enough — this is
// the main simplification over the split Pages/Render deployment, which needed
// SameSite=None and therefore mandatory HTTPS.
const base = {
  httpOnly: true,
  secure,
  sameSite: 'lax',
};

// NOTE: Next's cookies().set takes maxAge in SECONDS, unlike Express which uses
// milliseconds. Values below are seconds.
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookies.set(ACCESS_COOKIE, accessToken, { ...base, path: '/', maxAge: ACCESS_MAX_AGE });
  // Scoped to /api/auth so it's never sent on unrelated API calls.
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    ...base,
    path: '/api/auth',
    maxAge: REFRESH_MAX_AGE,
  });
}

export function clearAuthCookies(res) {
  res.cookies.set(ACCESS_COOKIE, '', { ...base, path: '/', maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...base, path: '/api/auth', maxAge: 0 });
}

export function setCsrfCookie(res, token) {
  // Not httpOnly: the frontend reads this to echo it back as a header.
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  });
}
