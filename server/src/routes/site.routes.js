import { Router } from 'express';
import { getSiteBanners, updateSiteBanners } from '../controllers/site.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// بانرات الصفحة الرئيسية للموقع — للمدير العام فقط
router.get('/banners', requireAuth, requireAdmin, getSiteBanners);
router.put('/banners', requireAuth, requireAdmin, updateSiteBanners);

export default router;
