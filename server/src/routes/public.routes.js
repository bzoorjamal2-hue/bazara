import { Router } from 'express';
import { param } from 'express-validator';
import { getHomeData, getStoreBySlug, getStoreCheckout, getProductById, getByCategory, getOffers, addReview, trackOrders } from '../controllers/public.controller.js';
import { validateCoupon } from '../controllers/coupon.controller.js';
import { createStockRequest } from '../controllers/stockRequest.controller.js';
import { chatAssistant } from '../controllers/assistant.controller.js';
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

// تقييد المساعِدة الذكية — استدعاءات النموذج مكلفة، فنحدّ كل IP
const assistantLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة للمساعِدة. حاولي بعد قليل.' },
});

router.get('/home', getHomeData);
router.get('/category/:cat', getByCategory);
router.get('/offers', getOffers);
router.get('/store/:slug', getStoreBySlug);
router.get('/store/:slug/checkout', getStoreCheckout);
router.get('/product/:id', idParam, handleValidation, getProductById);
router.post('/product/:id/reviews', reviewLimiter, idParam, reviewRules, handleValidation, addReview);
router.post('/coupon/validate', validateCoupon);
router.post('/track', trackOrders);
router.post('/stock-request', reviewLimiter, createStockRequest);
router.post('/assistant', assistantLimiter, chatAssistant);

export default router;
