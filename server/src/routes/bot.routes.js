import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getBotSettings, saveBotSettings, saveFloorPrice, tryBot } from '../controllers/bot.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// التجربةُ تنادي مزوّدَ الذكاءِ بكلِّ ضغطة، فهي البابُ الوحيدُ هنا الذي يُكلِّف.
// سقفٌ معقولٌ يكفي جلسةَ تجريبٍ كاملةً ولا يجعلُ التبويبَ صنبوراً مفتوحاً.
const tryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'جرّبتِ كثيراً بوقت قصير. استريحي دقائق ثم أكملي.' },
});

router.use(requireAuth); // كلُّ هذه المسارات تخصُّ صاحبةَ المتجر

router.get('/settings', getBotSettings);
router.put('/settings', saveBotSettings);
router.put('/floor', saveFloorPrice);
router.post('/try', tryLimiter, tryBot);

export default router;
