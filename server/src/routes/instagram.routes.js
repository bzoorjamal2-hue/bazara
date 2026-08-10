import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  igStatus,
  igConnect,
  igDisconnect,
  listConversations,
  listMessages,
  sendReply,
  convertToOrder,
} from '../controllers/instagram.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// حدّ لمحاولات الربط (تسجيل دخول فيسبوك)
const connectLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة. حاول لاحقاً.' },
});

router.use(requireAuth); // كل هذه المسارات تخصّ صاحب المتجر (الـ webhook مسجَّل منفصلاً)

router.get('/status', igStatus);
router.post('/connect', connectLimiter, igConnect);
router.post('/disconnect', igDisconnect);
router.get('/conversations', listConversations);
router.get('/conversations/:id/messages', listMessages);
router.post('/conversations/:id/reply', sendReply);
router.post('/conversations/:id/convert', convertToOrder);

export default router;
