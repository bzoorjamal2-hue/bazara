import { Router } from 'express';
import { getSiteBanners, updateSiteBanners, listNewsletter } from '../controllers/site.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// بانرات الصفحة الرئيسية للموقع — للمدير العام فقط
router.get('/banners', requireAuth, requireAdmin, getSiteBanners);
router.put('/banners', requireAuth, requireAdmin, updateSiteBanners);
// مشتركو النشرة (لا يخلط بـ/subscription/subscribers الخاص بالاشتراكات المدفوعة)
router.get('/newsletter', requireAuth, requireAdmin, listNewsletter);


export default router;
