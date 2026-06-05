import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, me, updateProfile } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidation, registerRules, loginRules, profileRules } from '../middleware/validate.js';

const router = Router();

// تقييد صارم لمحاولات تسجيل الدخول/التسجيل لمنع هجمات التخمين
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة جداً. حاول بعد قليل.' },
});

router.post('/register', authLimiter, registerRules, handleValidation, register);
router.post('/login', authLimiter, loginRules, handleValidation, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.put('/profile', requireAuth, profileRules, handleValidation, updateProfile);

export default router;
