import { Router } from 'express';
import { listMyReferrals } from '../controllers/referral.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// لوحة المتجر — قائمة الإحالات (مالك)
router.get('/', requireAuth, listMyReferrals);

export default router;
