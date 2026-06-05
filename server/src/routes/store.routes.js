import { Router } from 'express';
import { getMyStore, updateMyStore } from '../controllers/store.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidation, storeUpdateRules } from '../middleware/validate.js';

const router = Router();

router.get('/me', requireAuth, getMyStore);
router.put('/me', requireAuth, storeUpdateRules, handleValidation, updateMyStore);

export default router;
