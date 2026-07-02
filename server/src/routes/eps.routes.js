import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  epsStatus,
  epsConnect,
  epsDisconnect,
  epsSetOrigin,
  epsCities,
  epsSendOrder,
  epsOrderAwb,
  epsSync,
} from '../controllers/eps.controller.js';
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

router.get('/status', epsStatus);
router.post('/connect', connectLimiter, epsConnect);
router.post('/disconnect', epsDisconnect);
router.put('/origin', epsSetOrigin);
router.get('/cities', epsCities);
router.get('/sync', epsSync);
router.post('/orders/:id/send', epsSendOrder);
router.get('/orders/:id/awb', epsOrderAwb);

export default router;
