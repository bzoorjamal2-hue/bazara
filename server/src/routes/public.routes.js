import { Router } from 'express';
import { param } from 'express-validator';
import { getHomeData, getStoreBySlug, getProductById, getByCategory, addReview } from '../controllers/public.controller.js';
import { validateCoupon } from '../controllers/coupon.controller.js';
import { handleValidation, reviewRules } from '../middleware/validate.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const idParam = [param('id').isUUID().withMessage('معرّف غير صالح.')];

// تقييد إضافة المراجعات لمنع الإغراق
const reviewLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة. حاول لاحقاً.' },
});

router.get('/home', getHomeData);
router.get('/category/:cat', getByCategory);
router.get('/store/:slug', getStoreBySlug);
router.get('/product/:id', idParam, handleValidation, getProductById);
router.post('/product/:id/reviews', reviewLimiter, idParam, reviewRules, handleValidation, addReview);
router.post('/coupon/validate', validateCoupon);

export default router;
