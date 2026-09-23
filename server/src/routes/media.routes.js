import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { presignUpload, processVideo, processAudio, videoStatus } from '../controllers/media.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// الرفعُ بلا حسابٍ مسموحٌ للصورِ وحدَها (تقييماتُ الزبونات) — فالسقفُ يمنعُ أن يصيرَ
// مخزنُنا مكبّاً مجّانياً: جلسةُ تاجرةٍ تضيفُ عشراتِ القطعِ تبقى تحتَه بمسافة.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'رفعتِ ملفات كثيرة بوقت قصير. استريحي قليلاً ثم أكملي.' },
});

router.post('/presign', uploadLimiter, optionalAuth, wrap(presignUpload));
router.post('/video/:id/process', requireAuth, wrap(processVideo));
router.post('/audio/:id/process', requireAuth, wrap(processAudio));
router.get('/video/:id', wrap(videoStatus));

export default router;
