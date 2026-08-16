import { Router } from 'express';
import { param } from 'express-validator';
import { subscribeNewsletter, getSiteInfo } from '../controllers/site.controller.js';
import { getHomeData, getPublicCategories, getStoreBySlug, getStoreCheckout, getStoreAreas, getProductById, getProductsByIds, getByCategory, getOffers, getReels, getStoriesFeed, addReview, trackOrders, trackStoreVisit, loyaltyPreview, searchProducts } from '../controllers/public.controller.js';
import { validateCoupon } from '../controllers/coupon.controller.js';
import { createStockRequest } from '../controllers/stockRequest.controller.js';
import { saveAbandoned } from '../controllers/abandoned.controller.js';
import { viewStory } from '../controllers/story.controller.js';
import { chatAssistant } from '../controllers/assistant.controller.js';
import { createReferral, validateReferral } from '../controllers/referral.controller.js';
import { handleValidation, reviewRules } from '../middleware/validate.js';
import { cacheGet } from '../middleware/cache.js';
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

// كاش ذاكرة قصير (30ث) للصفحات العامة كثيرة الزيارة — يخدمها فوراً بلا استعلام متكرّر
router.get('/home', cacheGet(30), getHomeData);
router.get('/site-info', cacheGet(120), getSiteInfo); // حسابات المنصّة للفوتر (كاش أطول — نادر التغيّر)
router.get('/search', cacheGet(15), searchProducts); // بحث شامل عبر المنصّة (كاش أقصر — استعلامات متنوعة)
router.get('/categories', cacheGet(60), getPublicCategories); // فئات مخصّصة مجمّعة لصفحة التصنيفات العامة
router.get('/category/:cat', cacheGet(30), getByCategory);
router.get('/offers', cacheGet(30), getOffers);
router.get('/reels', cacheGet(30), getReels);
router.get('/stories', cacheGet(30), getStoriesFeed);
router.post('/story/:id/view', viewStory);
router.get('/store/:slug', cacheGet(30), getStoreBySlug);
router.get('/store/:slug/checkout', getStoreCheckout);
// قرى/مناطق مدينة معيّنة (من أوبتيموس للمتاجر المربوطة) — تُطلب بعد اختيار المدينة
router.get('/store/:slug/areas', cacheGet(300), getStoreAreas);
router.post('/store/:slug/visit', trackStoreVisit);
// منتجات متعدّدة بطلب واحد (?ids=1,2,3) — تستخدمها المفضّلة بدل طلب لكل قطعة
router.get('/products', cacheGet(15), getProductsByIds);
router.get('/product/:id', idParam, handleValidation, getProductById);
router.post('/product/:id/reviews', reviewLimiter, idParam, reviewRules, handleValidation, addReview);
router.post('/coupon/validate', validateCoupon);
router.post('/loyalty', loyaltyPreview); // معاينة خصم الولاء (كل N طلبات → خصم %)
router.post('/track', trackOrders);
router.post('/stock-request', reviewLimiter, createStockRequest);
// مسودة طلب غير مكتمل — تُرسَل تلقائياً أثناء تعبئة شاشة الإتمام (حدّ أوسع من المراجعات
// لأنها تُستدعى مع التعديل المتكرر أثناء الكتابة)
const abandonedLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 80, standardHeaders: true, legacyHeaders: false, message: { error: 'محاولات كثيرة.' } });
router.post('/abandoned', abandonedLimiter, saveAbandoned);
// اشتراك النشرة — حدّ صارم (نموذج عام مكشوف)
const subscribeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'محاولات كثيرة. حاولي لاحقاً.' } });
router.post('/subscribe', subscribeLimiter, subscribeNewsletter);
router.post('/assistant', assistantLimiter, chatAssistant);
router.post('/referral', reviewLimiter, createReferral);
router.get('/referral/:code', validateReferral);

export default router;
