import { Router } from 'express';
import { listMyCoupons, createCoupon, updateCoupon, deleteCoupon } from '../controllers/coupon.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, listMyCoupons);
router.post('/', requireAuth, createCoupon);
router.put('/:id', requireAuth, updateCoupon);
router.delete('/:id', requireAuth, deleteCoupon);

export default router;
