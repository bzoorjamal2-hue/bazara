import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { checkout, verify, listMyOrders } from '../controllers/order.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة. حاول لاحقاً.' },
});

router.post('/checkout', checkoutLimiter, checkout);
router.get('/verify/:reference', verify);
router.get('/mine', requireAuth, listMyOrders);

export default router;
