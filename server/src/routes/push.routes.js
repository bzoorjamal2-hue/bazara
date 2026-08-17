import { Router } from 'express';
import { publicKey, subscribe, unsubscribe, registerNative, unregisterNative, campaignStatus, sendCampaign } from '../controllers/push.controller.js';
import { requireAuth } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// حدّ صارم على إرسال الحملات (احتياط فوق التهدئة بالكنترولر)
const campaignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة. حاول لاحقاً.' },
});

router.get('/public-key', publicKey);
router.post('/subscribe', requireAuth, subscribe);
router.post('/unsubscribe', requireAuth, unsubscribe);
// توكنات الأجهزة الأصلية (تطبيق iOS/Android المغلّف)
router.post('/register-native', requireAuth, registerNative);
router.post('/unregister-native', requireAuth, unregisterNative);
// حملات إشعارات المتجر (لصاحب المتجر)
router.get('/campaign', requireAuth, campaignStatus);
router.post('/campaign', requireAuth, campaignLimiter, sendCampaign);

export default router;
