import { Router } from 'express';
import { listMyStockRequests, deleteStockRequest, convertStockRequest, stockRequestCounts } from '../controllers/stockRequest.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, listMyStockRequests);
router.get('/counts', requireAuth, stockRequestCounts);
router.post('/:id/convert', requireAuth, convertStockRequest);
router.delete('/:id', requireAuth, deleteStockRequest);

export default router;
