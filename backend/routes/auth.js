const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const {
  signAccessToken,
  signMfaPendingToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} = require('../utils/jwt');
const { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } = require('../utils/cookies');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function publicUser(user) {
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

// Issues a fresh access + refresh token pair, persists the refresh token's hash so it
// can be looked up / revoked later, and writes both as httpOnly cookies.
async function issueSession(req, res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  setAuthCookies(res, { accessToken, refreshToken });
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || typeof name !== 'string' || !email || typeof email !== 'string' || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a symbol',
      });
    }

    const normalizedEmail = validator.normalizeEmail(email) || email.toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: validator.escape(name.trim()),
      email: normalizedEmail,
      passwordHash,
      role: role === 'admin' ? 'admin' : 'student',
    });

    await issueSession(req, res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const normalizedEmail = validator.normalizeEmail(email) || email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+mfaSecret +failedLoginAttempts +lockUntil +tokenVersion'
    );
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Account temporarily locked due to failed login attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    if (user.mfaEnabled) {
      const mfaToken = signMfaPendingToken(user);
      return res.json({ mfaRequired: true, mfaToken });
    }

    await issueSession(req, res, user);
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/mfa/verify-login', authLimiter, async (req, res) => {
  try {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) {
      return res.status(400).json({ message: 'mfaToken and code are required' });
    }

    let payload;
    try {
      payload = verifyAccessToken(mfaToken);
    } catch {
      return res.status(401).json({ message: 'MFA session expired, please log in again' });
    }
    if (!payload.mfaPending) {
      return res.status(400).json({ message: 'Invalid MFA session' });
    }

    const user = await User.findById(payload.sub).select('+mfaSecret +tokenVersion');
    if (!user || !user.mfaEnabled) {
      return res.status(400).json({ message: 'MFA is not enabled for this account' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return res.status(401).json({ message: 'Invalid authentication code' });
    }

    await issueSession(req, res, user);
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'MFA verification failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({ message: 'Missing refresh token' });
    }

    const tokenHash = hashRefreshToken(token);
    const stored = await RefreshToken.findOne({ tokenHash });

    // Reuse of a revoked/rotated refresh token is a strong signal of theft: kill every
    // session for that user rather than trusting either the old or new token.
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      if (stored && stored.revoked) {
        await RefreshToken.updateMany({ user: stored.user, revoked: false }, { revoked: true });
        await User.findByIdAndUpdate(stored.user, { $inc: { tokenVersion: 1 } });
      }
      clearAuthCookies(res);
      return res.status(401).json({ message: 'Session expired, please log in again' });
    }

    const user = await User.findById(stored.user).select('+tokenVersion');
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ message: 'User no longer exists' });
    }

    const newRefreshToken = generateRefreshToken();
    stored.revoked = true;
    stored.replacedByHash = hashRefreshToken(newRefreshToken);
    await stored.save();

    await RefreshToken.create({
      user: user._id,
      tokenHash: stored.replacedByHash,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    const accessToken = signAccessToken(user);
    setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Could not refresh session' });
  }
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await RefreshToken.updateOne({ tokenHash: hashRefreshToken(token) }, { revoked: true });
  }
  clearAuthCookies(res);
  res.json({ message: 'Logged out' });
});

router.post('/logout-all', requireAuth, async (req, res) => {
  await RefreshToken.updateMany({ user: req.user._id, revoked: false }, { revoked: true });
  await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
  clearAuthCookies(res);
  res.json({ message: 'Logged out of all devices' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/mfa/setup', requireAuth, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `EduConnect (${req.user.email})`,
    });

    req.user.mfaSecret = secret.base32;
    await req.user.save();

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ qrDataUrl, secret: secret.base32 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to start MFA setup' });
  }
});

router.post('/mfa/enable', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user._id).select('+mfaSecret');
    if (!user.mfaSecret) {
      return res.status(400).json({ message: 'Run MFA setup first' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return res.status(401).json({ message: 'Invalid authentication code' });
    }

    user.mfaEnabled = true;
    await user.save();
    res.json({ message: 'MFA enabled', user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to enable MFA' });
  }
});

router.post('/mfa/disable', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user._id).select('+mfaEnabled +mfaSecret');
    if (!user.mfaEnabled) {
      return res.status(400).json({ message: 'MFA is not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return res.status(401).json({ message: 'Invalid authentication code' });
    }

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    await user.save();
    res.json({ message: 'MFA disabled', user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to disable MFA' });
  }
});

module.exports = router;
