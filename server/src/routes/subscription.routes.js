import { Router } from 'express';
import {
  getStatus,
  requestSubscription,
  listRequests,
  approveRequest,
  rejectRequest,
  getSettings,
  updateSettings,
  redeemCode,
  generateCodes,
  listCodes,
  sendCodeToSubscriber,
  listSubscribers,
  deleteSubscriber,
  setSubscription,
} from '../controllers/subscription.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { handleValidation, idParamRule } from '../middleware/validate.js';

const router = Router();

// للمستخدم
router.get('/status', requireAuth, getStatus);
router.post('/request', requireAuth, requestSubscription);
router.post('/redeem', requireAuth, redeemCode);

// أكواد التفعيل والمشتركون (للمدير)
router.get('/codes', requireAuth, requireAdmin, listCodes);
router.post('/codes', requireAuth, requireAdmin, generateCodes);
router.post('/send-code', requireAuth, requireAdmin, sendCodeToSubscriber);
router.get('/subscribers', requireAuth, requireAdmin, listSubscribers);
router.post('/set-subscription', requireAuth, requireAdmin, setSubscription);
router.post('/delete-subscriber', requireAuth, requireAdmin, deleteSubscriber);

// للمدير
router.get('/settings', requireAuth, requireAdmin, getSettings);
router.put('/settings', requireAuth, requireAdmin, updateSettings);
router.get('/requests', requireAuth, requireAdmin, listRequests);
router.post('/requests/:id/approve', requireAuth, requireAdmin, idParamRule, handleValidation, approveRequest);
router.post('/requests/:id/reject', requireAuth, requireAdmin, idParamRule, handleValidation, rejectRequest);

export default router;
