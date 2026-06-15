import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import pool from './config/db.js';

import authRoutes from './routes/auth.routes.js';
import storeRoutes from './routes/store.routes.js';
import productRoutes from './routes/product.routes.js';
import publicRoutes from './routes/public.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import orderRoutes from './routes/order.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import stockRequestRoutes from './routes/stockRequest.routes.js';
import pushRoutes from './routes/push.routes.js';
import { robots, sitemap, indexNowKey } from './controllers/seo.controller.js';
import { issueCsrfToken, verifyCsrf, getCsrfToken } from './middleware/csrf.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// الثقة بالبروكسي (مطلوبة على Render/Railway لتعمل secure cookies و rate limit)
app.set('trust proxy', 1);

// رؤوس أمان HTTP
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // الواجهة منفصلة؛ نترك CSP لمضيف الواجهة
  })
);

// CORS مع دعم الكوكيز
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      // نسمح بالطلبات بدون origin (مثل أدوات الخادم) وبالأصول المسموحة
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '12mb' })); // يتسع لصور مرفوعة (base64) بعد التصغير
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// تقييد عام لكل الطلبات
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'طلبات كثيرة جداً. حاول لاحقاً.' },
  })
);

// إصدار توكن CSRF ثم التحقق منه في الطلبات المعدِّلة
app.use(issueCsrfToken);
app.use('/api', verifyCsrf);

// فحص صحة الخادم + مسار توكن CSRF
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/csrf', getCsrfToken);

// مسارات الـ API
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/stock-requests', stockRequestRoutes);
app.use('/api/push', pushRoutes);

// مسارات SEO (على الجذر)
app.get('/robots.txt', robots);
app.get('/sitemap.xml', sitemap);
app.get('/:key([a-f0-9]+\\.txt)', indexNowKey); // ملف مفتاح IndexNow

// 404 ومعالج الأخطاء
app.use(notFound);
app.use(errorHandler);

// ترقيات تلقائية خفيفة عند الإقلاع (idempotent وفورية، بلا إعادة بناء جداول)
async function ensureColumns() {
  try {
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS banners JSONB DEFAULT '[]'::jsonb;");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS facebook VARCHAR(200) DEFAULT '';");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';");
    // كمية المخزون لكل مقاس (نمرة): {"38": 5, "40": 2, ...}
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS size_stock JSONB DEFAULT '{}'::jsonb;");
    // مخزون لكل لون ثم لكل نمرة: {"أسود": {"38": 3, "40": 2}, "أبيض": {"38": 1}}
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS color_stock JSONB DEFAULT '{}'::jsonb;");
    // نهاية العرض (عدّاد تنازلي) — عند انتهائه يعود السعر الأصلي تلقائياً
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ;");
    // مناطق التوصيل القابلة للتخصيص + شحن مجاني فوق مبلغ
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_zones JSONB DEFAULT '[]'::jsonb;");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS free_shipping_over NUMERIC(10,2) DEFAULT 0;");
    // دليل المقاسات المخصّص لكل متجر: {"38": {"bust":88,"waist":70,"hips":94}, ...}
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS size_chart JSONB DEFAULT '{}'::jsonb;");
    // سياسة الإرجاع والتبديل (نص يظهر للزبون بصفحة المنتج)
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS return_policy TEXT DEFAULT '';");
    // شريط إعلانات علوي + عرض/كوبون ترحيبي (نافذة أول زيارة)
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS announcement VARCHAR(200) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS welcome_offer VARCHAR(300) DEFAULT '';");
    // صورة مرفقة مع تقييم الزبون
    await pool.query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';");
    // طلبات الدفع عند الاستلام (واتساب): حقول التوصيل
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR(80) DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0;");
    // الكوبونات: كود الخصم وقيمته المطبّقة على الطلب
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(40) DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0;");
    // هل خُصم المخزون لهذا الطلب؟ (يُخصم عند التأكيد ويُعاد عند الإلغاء)
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_applied BOOLEAN NOT NULL DEFAULT false;");
    // جدول الكوبونات (كود خصم لكل متجر)
    await pool.query(`CREATE TABLE IF NOT EXISTS coupons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      code VARCHAR(40) NOT NULL,
      type VARCHAR(10) NOT NULL DEFAULT 'percent',
      value NUMERIC(10,2) NOT NULL DEFAULT 0,
      min_total NUMERIC(10,2) NOT NULL DEFAULT 0,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (store_id, code)
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_coupons_store ON coupons(store_id);');
    // طلبات التنبيه عند توفّر المنتج (نمرة/لون نفد)
    await pool.query(`CREATE TABLE IF NOT EXISTS stock_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      product_name VARCHAR(150) DEFAULT '',
      color VARCHAR(50) DEFAULT '',
      size VARCHAR(20) DEFAULT '',
      phone VARCHAR(40) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_stockreq_store ON stock_requests(store_id);');
    // اشتراكات إشعارات الدفع (Web Push) لكل مستخدم/جهاز
    await pool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);');
  } catch (err) {
    console.error('⚠️ تعذّر تطبيق الترقيات:', err.message);
  }
}

function start() {
  app.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  });
}

// الترقية التلقائية على الإنتاج فقط (Render). محلياً نشغّل مباشرة بلا لمس قاعدة البيانات.
if (process.env.NODE_ENV === 'production') {
  ensureColumns().finally(start);
} else {
  start();
}

export default app;
