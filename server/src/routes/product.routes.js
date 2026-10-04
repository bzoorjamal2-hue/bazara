import { Router } from 'express';
import {
  listMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  setProductVisibility,
} from '../controllers/product.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { handleValidation, productRules, idParamRule } from '../middleware/validate.js';

const router = Router();

// كل المسارات تتطلب تسجيل دخول، والملكية تُفحص داخل المتحكم
router.get('/', requireAuth, listMyProducts);
router.post('/', requireAuth, productRules, handleValidation, createProduct);
router.put('/:id', requireAuth, idParamRule, productRules, handleValidation, updateProduct);
router.patch('/:id/visibility', requireAuth, idParamRule, handleValidation, setProductVisibility);
router.delete('/:id', requireAuth, idParamRule, handleValidation, deleteProduct);

export default router;
