import { Router } from 'express';
import { publicKey, subscribe, unsubscribe, registerNative, unregisterNative } from '../controllers/push.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/public-key', publicKey);
router.post('/subscribe', requireAuth, subscribe);
router.post('/unsubscribe', requireAuth, unsubscribe);
// توكنات الأجهزة الأصلية (تطبيق iOS/Android المغلّف)
router.post('/register-native', requireAuth, registerNative);
router.post('/unregister-native', requireAuth, unregisterNative);

export default router;
