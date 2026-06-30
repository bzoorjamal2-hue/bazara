import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  opostStatus,
  opostConnect,
  opostDisconnect,
  opostSetAddress,
  opostCities,
  opostAreas,
  opostShipmentTypes,
  opostSendOrder,
  opostSync,
} from '../controllers/opost.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// حدّ لمحاولات الربط (تسجيل دخول أوبتيموس) — يمنع التجربة العمياء لكلمات السر
const connectLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة. حاول لاحقاً.' },
});

router.use(requireAuth); // كل مسارات أوبتيموس تخصّ صاحب المتجر

router.get('/status', opostStatus);
router.post('/connect', connectLimiter, opostConnect);
router.post('/disconnect', opostDisconnect);
router.put('/address', opostSetAddress);
router.get('/cities', opostCities);
router.get('/areas', opostAreas);
router.get('/shipment-types', opostShipmentTypes);
router.get('/sync', opostSync);
router.post('/orders/:id/send', opostSendOrder);

export default router;
