import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  loginWithCode,
  logout,
  me,
  updateProfile,
  changePassword,
  changeEmail,
  forgotPassword,
  resetPassword,
  adminResetPassword,
} from '../controllers/auth.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  handleValidation,
  registerRules,
  loginRules,
  loginWithCodeRules,
  profileRules,
  changePasswordRules,
  changeEmailRules,
  forgotPasswordRules,
  resetPasswordRules,
  adminResetRules,
} from '../middleware/validate.js';

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
router.post('/login-with-code', authLimiter, loginWithCodeRules, handleValidation, loginWithCode);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.put('/profile', requireAuth, profileRules, handleValidation, updateProfile);
router.put('/password', requireAuth, changePasswordRules, handleValidation, changePassword);
router.put('/email', requireAuth, changeEmailRules, handleValidation, changeEmail);

// استعادة كلمة المرور (بدون تسجيل دخول)
router.post('/forgot-password', authLimiter, forgotPasswordRules, handleValidation, forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordRules, handleValidation, resetPassword);

// إعادة تعيين كلمة مرور مستخدم (للمدير)
router.post('/admin/reset-password', requireAuth, requireAdmin, adminResetRules, handleValidation, adminResetPassword);

export default router;
