import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getStatus,
  requestSubscription,
  subscriptionCheckout,
  subscriptionVerify,
  listRequests,
  approveRequest,
  rejectRequest,
  getSettings,
  updateSettings,
  redeemCode,
  generateCodes,
  listCodes,
  sendCodeToSubscriber,
  listSubscribers,
  getStoreDetail,
  listStoreProducts,
  hideProduct,
  unhideProduct,
  listAdminLog,
  suspendSubscriber,
  unsuspendSubscriber,
  fixAccount,
  deleteSubscriber,
  setSubscription,
  addSubscriptionDays,
  stopSubscription,
  impersonate,
  getAdminStats,
  setStoreFeatured,
  broadcastMessage,
} from '../controllers/subscription.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { handleValidation, idParamRule } from '../middleware/validate.js';

const router = Router();

const impersonateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة لفتح جلسات تصفّح. حاول لاحقاً.' },
});

// للمستخدم
router.get('/status', requireAuth, getStatus);
router.post('/request', requireAuth, requestSubscription);
router.post('/checkout', requireAuth, subscriptionCheckout);
router.get('/verify', requireAuth, subscriptionVerify);
router.post('/redeem', requireAuth, redeemCode);

// أكواد التفعيل والمشتركون (للمدير)
router.get('/codes', requireAuth, requireAdmin, listCodes);
router.post('/codes', requireAuth, requireAdmin, generateCodes);
router.post('/send-code', requireAuth, requireAdmin, sendCodeToSubscriber);
router.get('/admin-stats', requireAuth, requireAdmin, getAdminStats);
router.get('/subscribers', requireAuth, requireAdmin, listSubscribers);
router.get('/store/:slug', requireAuth, requireAdmin, getStoreDetail);
router.get('/store/:slug/products', requireAuth, requireAdmin, listStoreProducts);
router.post('/product/:id/hide', requireAuth, requireAdmin, hideProduct);
router.post('/product/:id/unhide', requireAuth, requireAdmin, unhideProduct);
router.get('/admin-log', requireAuth, requireAdmin, listAdminLog);
router.post('/suspend', requireAuth, requireAdmin, suspendSubscriber);
router.post('/unsuspend', requireAuth, requireAdmin, unsuspendSubscriber);
router.post('/fix-account', requireAuth, requireAdmin, fixAccount);
router.post('/set-subscription', requireAuth, requireAdmin, setSubscription);
router.post('/add-days', requireAuth, requireAdmin, addSubscriptionDays);
// إنهاء اشتراك (لم تدفع/ألغت) — يُغلق المتجر برسالة «انتهى اشتراكك» لا «موقوف»
router.post('/stop-subscription', requireAuth, requireAdmin, stopSubscription);
// جلسة تصفّح نيابيّ قصيرة الأجل. حدّ صارم: أداة دعمٍ لا تُفتح عشرات المرّات
// بالساعة، وأيّ اندفاعٍ عليها إشارةٌ تستحقّ الوقوف عندها.
router.post('/impersonate', requireAuth, requireAdmin, impersonateLimiter, impersonate);
router.post('/delete-subscriber', requireAuth, requireAdmin, deleteSubscriber);
router.post('/set-featured', requireAuth, requireAdmin, setStoreFeatured);
router.post('/broadcast', requireAuth, requireAdmin, broadcastMessage);

// للمدير
router.get('/settings', requireAuth, requireAdmin, getSettings);
router.put('/settings', requireAuth, requireAdmin, updateSettings);
router.get('/requests', requireAuth, requireAdmin, listRequests);
router.post('/requests/:id/approve', requireAuth, requireAdmin, idParamRule, handleValidation, approveRequest);
router.post('/requests/:id/reject', requireAuth, requireAdmin, idParamRule, handleValidation, rejectRequest);

export default router;
