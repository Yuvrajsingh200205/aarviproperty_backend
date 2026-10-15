const router = require('express').Router();
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { signToken, requireAuth } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : Number(process.env.LOGIN_RATE_LIMIT) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, try again later' },
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(100),
});
const profileSchema = z.object({ name: z.string().trim().min(2).max(80) });

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.isActive || !(await user.checkPassword(password))) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    res.json({ success: true, token: signToken(user), user });
  })
);

router.get('/me', requireAuth, (req, res) => res.json({ success: true, user: req.user }));

router.put(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name } = profileSchema.parse(req.body);
    req.user.name = name;
    await req.user.save();
    res.json({ success: true, user: req.user });
  })
);

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = passwordSchema.parse(req.body);
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await user.checkPassword(currentPassword))) throw ApiError.badRequest('Current password is incorrect');
    await user.setPassword(newPassword);
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  })
);

module.exports = router;
