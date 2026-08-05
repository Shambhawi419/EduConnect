const crypto = require('crypto');
const { CSRF_COOKIE } = require('../utils/cookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Double-submit cookie pattern: the cookie is JS-readable (not httpOnly) so the
// frontend can echo it back as a header. A cross-site form/fetch can make the browser
// send the cookie automatically, but it cannot read the cookie to set the matching
// header, so forged mutating requests fail this check.
function ensureCsrfCookie(req, res, next) {
  if (!req.cookies[CSRF_COOKIE]) {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/',
    });
    req.cookies[CSRF_COOKIE] = token;
  }
  next();
}

function requireCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'];

  if (
    !cookieToken ||
    !headerToken ||
    typeof headerToken !== 'string' ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return res.status(403).json({ message: 'Invalid or missing CSRF token' });
  }
  next();
}

module.exports = { ensureCsrfCookie, requireCsrf };
