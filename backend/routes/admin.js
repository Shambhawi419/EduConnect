const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await User.find().select('-passwordHash -mfaSecret');
  res.json({ users });
});

module.exports = router;
