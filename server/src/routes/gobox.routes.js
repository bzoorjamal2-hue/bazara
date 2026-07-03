import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  goboxStatus,
  goboxConnect,
  goboxDisconnect,
  goboxSetOrigin,
  goboxVillages,
  goboxSendOrder,
  goboxOrderAwb,
  goboxSync,
} from '../controllers/gobox.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// حدّ لمحاولات الربط — يمنع التجربة العمياء لكلمات السر
const connectLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة. حاول لاحقاً.' },
});

// ملاحظة: مسار الـ webhook العام مُسجّل في index.js (قبل CSRF) — كل ما هنا يخصّ صاحب المتجر
router.use(requireAuth);

router.get('/status', goboxStatus);
router.post('/connect', connectLimiter, goboxConnect);
router.post('/disconnect', goboxDisconnect);
router.put('/origin', goboxSetOrigin);
router.get('/villages', goboxVillages);
router.get('/sync', goboxSync);
router.post('/orders/:id/send', goboxSendOrder);
router.get('/orders/:id/awb', goboxOrderAwb);

export default router;
