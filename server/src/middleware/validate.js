import { body, param, validationResult } from 'express-validator';

// يجمع أخطاء التحقق ويعيدها برسالة عربية موحّدة
export function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'بيانات غير صحيحة.',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// كلمة مرور قوية: 8 أحرف على الأقل + حرف + رقم + رمز
const STRONG_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// يقبل رابطاً عادياً أو صورة مضمّنة (data URL) — للرفع من الجهاز
function isUrlOrDataImage(value) {
  if (!value) return true;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(value)) return true;
  return /^https?:\/\/.+/i.test(value);
}

export const registerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('الاسم يجب أن يكون بين 2 و100 حرف.'),
  body('email').trim().isEmail().withMessage('بريد إلكتروني غير صالح.').normalizeEmail(),
  body('password')
    .matches(STRONG_PASSWORD)
    .withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم ورمز.'),
  body('storeName').trim().isLength({ min: 2, max: 120 }).withMessage('اسم المتجر يجب أن يكون بين 2 و120 حرف.'),
  body('phone').trim().matches(/^[+\d][\d\s-]{6,20}$/).withMessage('رقم هاتف غير صالح.'),
];

export const loginRules = [
  body('email').trim().isEmail().withMessage('بريد إلكتروني غير صالح.').normalizeEmail(),
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة.'),
];

export const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('كلمة المرور الحالية مطلوبة.'),
  body('newPassword').matches(STRONG_PASSWORD).withMessage('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم ورمز.'),
];

export const changeEmailRules = [
  body('currentPassword').notEmpty().withMessage('كلمة المرور مطلوبة.'),
  body('newEmail').trim().isEmail().withMessage('بريد إلكتروني غير صالح.').normalizeEmail(),
];

export const forgotPasswordRules = [
  body('email').trim().isEmail().withMessage('بريد إلكتروني غير صالح.').normalizeEmail(),
];

export const resetPasswordRules = [
  body('email').trim().isEmail().withMessage('بريد إلكتروني غير صالح.').normalizeEmail(),
  body('token').notEmpty().withMessage('رمز غير صالح.'),
  body('newPassword').matches(STRONG_PASSWORD).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم ورمز.'),
];

export const adminResetRules = [
  body('email').trim().isEmail().withMessage('بريد إلكتروني غير صالح.').normalizeEmail(),
  body('newPassword').matches(STRONG_PASSWORD).withMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم ورمز.'),
];

export const profileRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('الاسم يجب أن يكون بين 2 و100 حرف.'),
  body('avatarUrl').optional({ nullable: true, checkFalsy: true }).custom(isUrlOrDataImage).withMessage('صورة غير صالحة.'),
];

export const storeUpdateRules = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('اسم المتجر يجب أن يكون بين 2 و120 حرف.'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 1000 }).withMessage('الوصف طويل جداً.'),
  body('logoUrl').optional({ nullable: true, checkFalsy: true }).custom(isUrlOrDataImage).withMessage('شعار غير صالح.'),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 40 }),
  body('whatsapp').optional({ nullable: true }).trim().isLength({ max: 40 }),
  body('instagram').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('tiktok').optional({ nullable: true }).trim().isLength({ max: 120 }),
  body('themeColor').optional({ nullable: true, checkFalsy: true }).matches(/^#[0-9a-fA-F]{6}$/).withMessage('لون غير صالح.'),
  body('deliveryInfo').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  body('paymentInfo').optional({ nullable: true }).trim().isLength({ max: 1000 }),
];

const CATEGORIES = ['abaya', 'set', 'dress', 'hijab'];

export const productRules = [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('اسم المنتج مطلوب (2-150 حرف).'),
  body('price').isFloat({ min: 0 }).withMessage('السعر يجب أن يكون رقماً موجباً.'),
  body('oldPrice').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('السعر القديم غير صالح.'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }).withMessage('الوصف طويل جداً.'),
  body('size').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('color').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('category').isIn(CATEGORIES).withMessage('فئة غير صالحة.'),
  body('imageUrl').optional({ nullable: true, checkFalsy: true }).custom(isUrlOrDataImage).withMessage('صورة غير صالحة.'),
  body('images').optional({ nullable: true }).isArray({ max: 6 }).withMessage('عدد الصور كثير (6 كحد أقصى).'),
  body('images.*').optional().custom(isUrlOrDataImage).withMessage('إحدى الصور غير صالحة.'),
  body('stock').optional({ nullable: true }).isInt({ min: 0 }).withMessage('المخزون يجب أن يكون رقماً صحيحاً.'),
  body('featured').optional({ nullable: true }).isBoolean().withMessage('قيمة غير صالحة.'),
];

export const reviewRules = [
  body('authorName').trim().isLength({ min: 2, max: 100 }).withMessage('الاسم مطلوب (2-100 حرف).'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('التقييم يجب أن يكون بين 1 و5.'),
  body('comment').optional({ nullable: true }).trim().isLength({ max: 1000 }).withMessage('التعليق طويل جداً.'),
];

export const idParamRule = [param('id').isUUID().withMessage('معرّف غير صالح.')];
