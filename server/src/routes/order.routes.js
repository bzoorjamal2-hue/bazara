import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { checkout, createCodOrder, updateOrderStatus, verify, listMyOrders, getStats, getNewOrdersCount } from '../controllers/order.controller.js';
import { listAbandoned, deleteAbandoned } from '../controllers/abandoned.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة. حاول لاحقاً.' },
});

// التحقّقُ من الدفع صار يُرجعُ لقطةَ الطلبِ (اسمٌ وهاتفٌ وعنوان) لتُبنى منها شهادةُ
// الشراء. المرجعُ سرٌّ لا يحملُه إلّا صاحبُ الطلب، لكنّ بابَ التخمينِ كان مفتوحاً بلا
// حدّ — والآن صارت الجائزةُ أكبرَ من «حالةِ طلبٍ ومبلغِه». عددٌ سخيٌّ للزبونةِ العائدةِ
// من البنك (وقد تُعيدُ التحميل مراراً)، وخانقٌ لمن يُجرّبُ المراجعَ واحداً واحداً.
const verifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة. حاول لاحقاً.' },
});

router.post('/checkout', checkoutLimiter, checkout);
router.post('/cod', checkoutLimiter, createCodOrder); // طلب الدفع عند الاستلام (واتساب) — عام
router.get('/verify/:reference', verifyLimiter, verify);
router.get('/mine', requireAuth, listMyOrders);
router.get('/abandoned', requireAuth, listAbandoned); // الطلبات غير المكتملة — للمشترك
router.delete('/abandoned/:id', requireAuth, deleteAbandoned);
router.get('/stats', requireAuth, getStats); // إحصائيات المتجر — للمشترك
router.get('/new-count', requireAuth, getNewOrdersCount); // عدد الطلبات الجديدة — للشارة
router.patch('/:id/status', requireAuth, updateOrderStatus); // تحديث حالة الطلب — للمشترك

export default router;
