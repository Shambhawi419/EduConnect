const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
});

// Tighter limit on credential-guessing surfaces. Keyed by IP + email so one attacker
// can't exhaust the budget for every account from a single IP, and a botnet targeting
// one account still gets capped per-source.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body?.email || '').toLowerCase()}`,
  message: { message: 'Too many attempts, please try again later' },
});

module.exports = { generalLimiter, authLimiter };
