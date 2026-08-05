const { verifyAccessToken } = require('../utils/jwt');
const { ACCESS_COOKIE } = require('../utils/cookies');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];

  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token' });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('+tokenVersion');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }
    // If the password was changed or "log out everywhere" was triggered since this
    // token was issued, tokenVersion has moved on and the token is dead on arrival.
    if ((user.tokenVersion || 0) !== payload.tv) {
      return res.status(401).json({ message: 'Session has been invalidated' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
