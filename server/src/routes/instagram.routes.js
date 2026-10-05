import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  igStatus,
  igConnect,
  igLinkToken,
  igPendingPages,
  igDisconnect,
  listConversations,
  listMessages,
  sendReply,
  convertToOrder,
  igOrderDraft,
  igReact,
  igTyping,
  igProductCard,
  igLeave,
  igSuggest,
  igQuickReplies,
  igSaveQuickReplies,
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

// «اقترح ردّ» يكلّفُ نداءَ نموذج: سقفٌ لكلِّ حسابٍ يمنعُ ضغطاً متكرّراً بالخطأ من أن يصيرَ فاتورة
const suggestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `sg:${req.user?.id || req.ip}`,
  message: { error: 'اقتراحات كثيرة خلال وقت قصير. جرّبي بعد دقائق.' },
});

router.use(requireAuth); // كل هذه المسارات تخصّ صاحب المتجر (الـ webhook مسجَّل منفصلاً)

router.get('/status', igStatus);
router.post('/connect', connectLimiter, igConnect);
router.post('/link-token', connectLimiter, igLinkToken);
router.get('/pending-pages', igPendingPages);
router.post('/disconnect', igDisconnect);
router.get('/conversations', listConversations);
router.get('/conversations/:id/messages', listMessages);
router.post('/conversations/:id/reply', sendReply);
router.post('/conversations/:id/react', igReact);
router.post('/conversations/:id/typing', igTyping);
router.post('/conversations/:id/leave', igLeave);
router.post('/conversations/:id/suggest', suggestLimiter, igSuggest);
router.post('/product-card', igProductCard);
router.get('/quick-replies', igQuickReplies);
router.put('/quick-replies', igSaveQuickReplies);
router.get('/conversations/:id/draft', igOrderDraft);
router.post('/conversations/:id/convert', convertToOrder);

export default router;
