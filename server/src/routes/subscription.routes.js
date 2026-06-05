import { Router } from 'express';
import {
  getStatus,
  requestSubscription,
  listRequests,
  approveRequest,
  rejectRequest,
  getSettings,
  updateSettings,
} from '../controllers/subscription.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { handleValidation, idParamRule } from '../middleware/validate.js';

const router = Router();

// للمستخدم
router.get('/status', requireAuth, getStatus);
router.post('/request', requireAuth, requestSubscription);

// للمدير
router.get('/settings', requireAuth, requireAdmin, getSettings);
router.put('/settings', requireAuth, requireAdmin, updateSettings);
router.get('/requests', requireAuth, requireAdmin, listRequests);
router.post('/requests/:id/approve', requireAuth, requireAdmin, idParamRule, handleValidation, approveRequest);
router.post('/requests/:id/reject', requireAuth, requireAdmin, idParamRule, handleValidation, rejectRequest);

export default router;
