import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  listAds, generateAd, createAd, updateAd, deleteAd,
  listAccounts, connectAccount, publishAd, toggleAd, adInsights,
} from '../controllers/ads.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// التوليدُ وحدَه ينادي مزوّدَ الذكاء. سقفٌ يكفي جلسةَ عملٍ كاملةً (عشرُ قطعٍ
// بثلاثِ محاولاتٍ لكلٍّ) ولا يجعلُ الزرَّ صنبوراً مفتوحاً.
const genLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ولّدتِ إعلانات كثيرة بوقت قصير. استريحي دقائق ثم أكملي.' },
});

router.use(requireAuth);

router.get('/', listAds);
router.post('/generate', genLimiter, generateAd);
router.post('/', createAd);
router.put('/:id', updateAd);
router.delete('/:id', deleteAd);

// التوصيلُ بميتا. النشرُ يمرُّ بسقفٍ خاصٍّ به: كلُّ نداءٍ يرفعُ صورةً وينشئُ أربعةَ
// كائناتٍ عندَ ميتا، وتكرارُه بالخطأ يملأُ حسابَ التاجرةِ حملاتٍ لم تطلبْها.
const publishLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'نشرتِ حملات كثيرة بساعة واحدة. استريحي قليلاً.' },
});

router.get('/accounts', listAccounts);
router.put('/account', connectAccount);
router.post('/:id/publish', publishLimiter, publishAd);
router.post('/:id/status', toggleAd);
router.get('/:id/insights', adInsights);

export default router;
