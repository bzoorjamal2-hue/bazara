import { Router } from 'express';
import { publicKey, subscribe, unsubscribe } from '../controllers/push.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/public-key', publicKey);
router.post('/subscribe', requireAuth, subscribe);
router.post('/unsubscribe', requireAuth, unsubscribe);

export default router;
