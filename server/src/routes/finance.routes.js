import { Router } from 'express';
import { financeSummary, createExpense, deleteExpense } from '../controllers/finance.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, financeSummary);
router.post('/expenses', requireAuth, createExpense);
router.delete('/expenses/:id', requireAuth, deleteExpense);

export default router;
