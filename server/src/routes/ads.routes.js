import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { listAds, generateAd, createAd, updateAd, deleteAd } from '../controllers/ads.controller.js';
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

export default router;
