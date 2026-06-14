import { Router } from 'express';
import { listMyStockRequests, deleteStockRequest } from '../controllers/stockRequest.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, listMyStockRequests);
router.delete('/:id', requireAuth, deleteStockRequest);

export default router;
