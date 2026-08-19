import { Router } from 'express';
import { financeSummary, createExpense, deleteExpense, courierSettlement, markCollected, undoCollected } from '../controllers/finance.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, financeSummary);
router.post('/expenses', requireAuth, createExpense);
router.delete('/expenses/:id', requireAuth, deleteExpense);
router.get('/couriers', requireAuth, courierSettlement);
router.post('/collect', requireAuth, markCollected);
router.post('/uncollect', requireAuth, undoCollected);

export default router;
