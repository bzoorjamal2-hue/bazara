import { Router } from 'express';
import { list, count, markRead, clearAll } from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// كلّها خاصّة بالمستخدم الحالي — لا معرّف مستخدمٍ بأيّ مسار، فلا تسريب بين الحسابات
router.use(requireAuth);

router.get('/', list);
router.get('/count', count);
router.post('/read', markRead);
router.delete('/', clearAll);

export default router;
