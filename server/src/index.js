import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
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
import financeRoutes from './routes/finance.routes.js';
import stockRequestRoutes from './routes/stockRequest.routes.js';
import referralRoutes from './routes/referral.routes.js';
import pushRoutes from './routes/push.routes.js';
import storyRoutes from './routes/story.routes.js';
import siteRoutes from './routes/site.routes.js';
import opostRoutes from './routes/opost.routes.js';
import { syncAllConnectedStores } from './controllers/opost.controller.js';
import { notifyAbandonedCheckouts } from './controllers/abandoned.controller.js';
import epsRoutes from './routes/eps.routes.js';
import { epsWebhook, syncAllEpsStores } from './controllers/eps.controller.js';
import goboxRoutes from './routes/gobox.routes.js';
import { goboxWebhook, syncAllGoboxStores } from './controllers/gobox.controller.js';
import instagramRoutes from './routes/instagram.routes.js';
import { verifyWebhook, receiveWebhook } from './controllers/instagram.controller.js';
import { robots, sitemap, indexNowKey, shareProduct, shareStore, shareStory } from './controllers/seo.controller.js';
import { issueCsrfToken, verifyCsrf, getCsrfToken } from './middleware/csrf.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// حرّاس انهيار — يمنعان أي خطأ غير ملتقَط (مهمة خلفية/webhook/رفض وعد) من قتل
// العملية كلها (Exited with status 1) وإسقاط كل الطلبات الجارية (مثل حفظ الإعدادات).
// نسجّل الخطأ ونُبقي الخادم حيّاً — استقرار أهم بكثير من الخروج على خطأ عابر.
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ unhandledRejection (تم تجاهله للإبقاء على الخادم):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ uncaughtException (تم تجاهله للإبقاء على الخادم):', err);
});

const app = express();
const PORT = process.env.PORT || 5000;

// الثقة بالبروكسي (مطلوبة على Render/Railway لتعمل secure cookies و rate limit)
app.set('trust proxy', 1);

// ضغط الاستجابات (gzip) — يصغّر JSON/HTML كثيراً فتصل أسرع
app.use(compression());

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

// نحتفظ بالجسم الخام لِـ webhook إنستغرام فقط — للتحقق من توقيع Meta (HMAC).
// نحصره بمسار الـ webhook حتى لا نضاعف ذاكرة كل طلب JSON عادي.
app.use(express.json({
  limit: '12mb', // يتسع لصور مرفوعة (base64) بعد التصغير
  verify: (req, _res, buf) => {
    if (req.originalUrl === '/api/instagram/webhook') req.rawBody = buf;
  },
}));
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
// webhook تحديثات شحنات EPS (LogesTechs) — يأتي من خوادمهم فلا كوكي/CSRF لديه،
// لذلك يُسجَّل قبل فحص CSRF. آمن: يطابق بالباركود فقط ولا يكشف بيانات.
app.post('/api/eps/webhook', epsWebhook);
// webhook تحديثات شحنات gobox (نفس نظام LogesTechs) — قبل CSRF أيضاً، يطابق بالباركود فقط.
app.post('/api/gobox/webhook', goboxWebhook);
// webhook رسائل إنستغرام — يأتي من خوادم Meta (بلا كوكي/CSRF). GET للتأكيد الأولي،
// POST للأحداث. آمن: نتحقق من توقيع Meta (HMAC) داخل المعالج قبل قبول أي رسالة.
app.get('/api/instagram/webhook', verifyWebhook);
app.post('/api/instagram/webhook', receiveWebhook);
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
app.use('/api/finance', financeRoutes);
app.use('/api/stock-requests', stockRequestRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/opost', opostRoutes);
app.use('/api/eps', epsRoutes);
app.use('/api/gobox', goboxRoutes);
app.use('/api/instagram', instagramRoutes);

// مسارات SEO (على الجذر)
app.get('/robots.txt', robots);
app.get('/sitemap.xml', sitemap);
// صفحات المشاركة بوسوم OG حقيقية (صورة المنتج/المتجر تظهر بمعاينة واتساب)
app.get('/share/product/:id', shareProduct);
app.get('/share/store/:slug', shareStore);
app.get('/share/story/:id', shareStory);
app.get('/:key([a-f0-9]+\\.txt)', indexNowKey); // ملف مفتاح IndexNow

// 404 ومعالج الأخطاء
app.use(notFound);
app.use(errorHandler);

// ترقيات تلقائية خفيفة عند الإقلاع (idempotent وفورية، بلا إعادة بناء جداول)
async function ensureColumns() {
  try {
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS banners JSONB DEFAULT '[]'::jsonb;");
    // الروابط القديمة للمتجر (تبقى شغّالة بعد تغيير رابط المتجر المخصّص)
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS old_slugs TEXT[] DEFAULT '{}';");
    // رقم واتساب شركة التوصيل (لزر "أرسل للتوصيل")
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(40) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS facebook VARCHAR(200) DEFAULT '';");
    // متجر مميّز: يختاره المدير ليتصدّر «متاجر مميزة» بالرئيسية (بدل الترتيب التلقائي)
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;');
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';");
    // كمية المخزون لكل مقاس (نمرة): {"38": 5, "40": 2, ...}
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS size_stock JSONB DEFAULT '{}'::jsonb;");
    // مخزون لكل لون ثم لكل نمرة: {"أسود": {"38": 3, "40": 2}, "أبيض": {"38": 1}}
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS color_stock JSONB DEFAULT '{}'::jsonb;");
    // صور لكل لون (Color Swatches): {"أسود": ["url1","url2"], ...}
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS color_images JSONB DEFAULT '{}'::jsonb;");
    // نهاية العرض (عدّاد تنازلي) — عند انتهائه يعود السعر الأصلي تلقائياً
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ;");
    // عدّاد المبيعات الحقيقي — يزيد عند تأكيد الطلب (دليل اجتماعي "تم بيع X قطعة")
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_count INTEGER NOT NULL DEFAULT 0;");
    // مناطق التوصيل القابلة للتخصيص + شحن مجاني فوق مبلغ
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_zones JSONB DEFAULT '[]'::jsonb;");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS free_shipping_over NUMERIC(10,2) DEFAULT 0;");
    // أسعار شرائح التوصيل القابلة للتعديل: {"wb":30,"quds":40,"dakhel":80} — تُطبَّق على قائمة المدن الموحّدة
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_tiers JSONB DEFAULT '{}'::jsonb;");
    // دليل المقاسات المخصّص لكل متجر: {"38": {"bust":88,"waist":70,"hips":94}, ...}
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS size_chart JSONB DEFAULT '{}'::jsonb;");
    // سياسة الإرجاع والتبديل (نص يظهر للزبون بصفحة المنتج)
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS return_policy TEXT DEFAULT '';");
    // شريط إعلانات علوي + عرض/كوبون ترحيبي (نافذة أول زيارة)
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS announcement VARCHAR(200) DEFAULT '';");
    await pool.query("ALTER TABLE stores ALTER COLUMN announcement TYPE VARCHAR(500);"); // عدة إعلانات (سطر لكل إعلان)
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS welcome_offer VARCHAR(300) DEFAULT '';");
    // إعلان الشريط بالإنجليزية (اختياري) — يظهر عند تحويل اللغة للإنجليزي
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS announcement_en VARCHAR(500) DEFAULT '';");
    // تخصيص الفئات لكل متجر: {"dress": {"image": "...", "name": "..."}, ...}
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS category_meta JSONB DEFAULT '{}'::jsonb;");
    // فئات إضافية مخصّصة لكل متجر: [{"key":"c_xxx","name":"...","image":"..."}]
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS custom_categories JSONB DEFAULT '[]'::jsonb;");
    // صورة مرفقة مع تقييم الزبون
    await pool.query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';");
    // طلبات الدفع عند الاستلام (واتساب): حقول التوصيل
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR(80) DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';");
    // القرية/المنطقة داخل المدينة — حقل مستقل يطابق "area" عند شركات التوصيل،
    // فيروح الطلب لأوبتيموس بضغطة بلا مطابقة تخمينية من العنوان الحرّ
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS area VARCHAR(80) DEFAULT '';");
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
    // طلب التوفّر بعد تحويله لطلب حقيقي (يُدار بالكامل: حالة + إرسال لشركة توصيل)
    await pool.query('ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;');
    // بيانات الزبونة الكاملة (اسم/مدينة/عنوان) تُجمع عند الطلب فيعرفها المتجر ويحوّلها بضغطة
    await pool.query("ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100) DEFAULT '';");
    await pool.query("ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS city VARCHAR(80) DEFAULT '';");
    await pool.query("ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';");
    // متى نبّهنا المالكة أن هذا الطلب رجع متوفّراً (تنبيه استباقي مرة واحدة عند إعادة التخزين)
    await pool.query('ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS restocked_at TIMESTAMPTZ;');
    // طلبات لم تكتمل (سلات متروكة ببيانات تواصل): صف واحد لكل (متجر، هاتف) يُحدَّث
    // مع كل تعديل، ويُحذف عند إتمام الطلب فعلياً — لمتابعة صاحب المتجر وإنقاذ البيع
    await pool.query(`CREATE TABLE IF NOT EXISTS abandoned_checkouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      name VARCHAR(100) DEFAULT '',
      phone VARCHAR(40) NOT NULL,
      city VARCHAR(80) DEFAULT '',
      address TEXT DEFAULT '',
      items JSONB NOT NULL DEFAULT '[]',
      total NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (store_id, phone)
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_abandoned_store ON abandoned_checkouts(store_id);');
    // هل أُشعر المالك بهذه السلة المتروكة؟ (يُصفَّر عند تحديث الزبونة لمسودّتها)
    await pool.query('ALTER TABLE abandoned_checkouts ADD COLUMN IF NOT EXISTS notified BOOLEAN NOT NULL DEFAULT false;');
    // بكسلات التمويل لكل متجر: يموّل صاحب المتجر منتجاته بإعلانات فيسبوك/تيكتوك/جوجل
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS fb_pixel VARCHAR(40) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS tiktok_pixel VARCHAR(40) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS ga_id VARCHAR(40) DEFAULT '';");
    // نقاط الولاء: بعد كل N طلبات مؤكّدة يحصل الزبون على خصم % على طلبه التالي
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS loyalty_every INTEGER NOT NULL DEFAULT 0;');
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS loyalty_percent NUMERIC(5,2) NOT NULL DEFAULT 0;');
    // عرض الفلاش: خصم % على كل المتجر مؤقّتاً (حتى flash_ends_at) — إلحاح للحملات
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS flash_percent NUMERIC(5,2) NOT NULL DEFAULT 0;');
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS flash_ends_at TIMESTAMPTZ;');
    // نظام الإحالة: نسبة خصم الزبونة الجديدة لكل متجر + جدول أكواد الإحالة + ربط الطلب بالكود
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS referral_percent NUMERIC(5,2) DEFAULT 0;');
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;');
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) DEFAULT '';");
    // ربط شركة التوصيل أوبتيموس (Opost) — توكنات مشفّرة لكل متجر + رقم تتبّع الشحنة على الطلب
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS opost_email VARCHAR(150) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS opost_access_token TEXT DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS opost_refresh_token TEXT DEFAULT '';");
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS opost_token_expires TIMESTAMPTZ;');
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS opost_business VARCHAR(40) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS opost_business_address VARCHAR(40) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS opost_shipment_type VARCHAR(40) DEFAULT '';");
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS opost_connected BOOLEAN NOT NULL DEFAULT false;');
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS opost_id VARCHAR(60) DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS opost_tracking VARCHAR(120) DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS opost_status VARCHAR(60) DEFAULT '';");
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS opost_sent_at TIMESTAMPTZ;');
    // ربط شركة التوصيل EPS (نظام LogesTechs) — كلمة السر مشفّرة + باركود التتبّع على الطلب
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS eps_email VARCHAR(150) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS eps_password TEXT DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS eps_city VARCHAR(40) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS eps_address VARCHAR(300) DEFAULT '';");
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS eps_connected BOOLEAN NOT NULL DEFAULT false;');
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS eps_id VARCHAR(60) DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS eps_barcode VARCHAR(120) DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS eps_status VARCHAR(80) DEFAULT '';");
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS eps_sent_at TIMESTAMPTZ;');
    // ربط شركة التوصيل gobox (نظام LogesTechs، company 15) — الموقع بالقرى (region+city+village)
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS gobox_email VARCHAR(150) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS gobox_password TEXT DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS gobox_region VARCHAR(40) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS gobox_city VARCHAR(40) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS gobox_village VARCHAR(40) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS gobox_address VARCHAR(300) DEFAULT '';");
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS gobox_connected BOOLEAN NOT NULL DEFAULT false;');
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS gobox_id VARCHAR(60) DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS gobox_barcode VARCHAR(120) DEFAULT '';");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS gobox_status VARCHAR(80) DEFAULT '';");
    await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS gobox_sent_at TIMESTAMPTZ;');
    await pool.query(`CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      code VARCHAR(20) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      name VARCHAR(80) DEFAULT '',
      uses INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (store_id, code),
      UNIQUE (store_id, phone)
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_referrals_store ON referrals(store_id);');
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
    // متابِعو المتجر (Web Push بلا تسجيل دخول): كل زبونة تفعّل إشعارات متجر معيّن
    // فيقدر صاحبه يبعث لها حملات (وصل جديد/خصم). مفصولة عن اشتراكات المستخدمين لأنها
    // مربوطة بالمتجر لا بحساب، وتشمل الضيوف (معظم الزباين بلا حساب).
    await pool.query(`CREATE TABLE IF NOT EXISTS store_followers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (store_id, endpoint)
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_store_followers_store ON store_followers(store_id);');
    // سجلّ حملات الإشعارات لكل متجر — لعرض "آخر حملة" وعدد المُرسَل، ولتحديد فترة التهدئة
    await pool.query(`CREATE TABLE IF NOT EXISTS store_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      sent_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_store_campaigns_store ON store_campaigns(store_id, created_at DESC);');
    // توكنات الأجهزة الأصلية (APNs لِـ iOS / FCM لِـ Android) — للتطبيق المغلّف بـ Capacitor
    await pool.query(`CREATE TABLE IF NOT EXISTS native_push_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      platform VARCHAR(10) NOT NULL DEFAULT 'ios',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_native_push_user ON native_push_tokens(user_id);');
    // ستوريات المتجر (تختفي بعد ٢٤ ساعة) — صورة/فيديو يضيفها المالك
    await pool.query(`CREATE TABLE IF NOT EXISTS stories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      media_url TEXT NOT NULL,
      media_type VARCHAR(10) NOT NULL DEFAULT 'image',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_stories_store ON stories(store_id, expires_at);');
    // منتج مرتبط بالستوري (اطلبي الآن) + تعليق نصّي + عدّاد مشاهدات
    await pool.query('ALTER TABLE stories ADD COLUMN IF NOT EXISTS product_id UUID;');
    await pool.query("ALTER TABLE stories ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT '';");
    await pool.query('ALTER TABLE stories ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;');
    // إعدادات الموقع العامة (صف واحد) — بانرات الصفحة الرئيسية يتحكّم بها المدير
    await pool.query(`CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      home_banners JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT site_settings_singleton CHECK (id = 1)
    );`);
    await pool.query("INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;");
    // شريط إعلان الصفحة الرئيسية (سطر لكل رسالة) — نفس فكرة إعلان المتجر لكن للمنصّة
    await pool.query("ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS announcement TEXT NOT NULL DEFAULT '';");
    await pool.query("ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS announcement_en TEXT NOT NULL DEFAULT '';");
    // مجموعات تحريرية بالرئيسية (تسوّقي حسب المناسبة): عنوان + صورة + كلمة بحث
    await pool.query("ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS collections JSONB NOT NULL DEFAULT '[]'::jsonb;");
    // مجموعات تحريرية لكل متجر (تسوّقي حسب المناسبة) — يحرّرها صاحب المتجر
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS collections JSONB NOT NULL DEFAULT '[]'::jsonb;");
    // لوك بوك الرئيسية: صورة إطلالة + معرّفات قطعها
    await pool.query("ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS lookbook JSONB NOT NULL DEFAULT '{}'::jsonb;");
    // حسابات المنصّة الرسمية بالفوتر (يحرّرها المدير) — إنستغرام/فيسبوك بازارا
    await pool.query("ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS instagram VARCHAR(200) NOT NULL DEFAULT '';");
    await pool.query("ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS facebook VARCHAR(200) NOT NULL DEFAULT '';");
    // مشتركو النشرة — بريد أو رقم واتساب. لا نخزّن أكثر من وسيلة التواصل ومصدرها.
    await pool.query(`CREATE TABLE IF NOT EXISTS subscribers (
      id SERIAL PRIMARY KEY,
      contact TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'email',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
    // فهارس أداء لاستعلامات العرض الأكثر تكراراً (الترتيب حسب المميّز/الأحدث) — تسرّع الصفحات العامة كلما زادت المنتجات
    await pool.query('CREATE INDEX IF NOT EXISTS idx_products_featured_created ON products(featured, created_at DESC);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_products_category_created ON products(category, created_at DESC);');
    // فهرس جزئي للعروض (منتجات مخفّضة فقط) — يسرّع صفحة العروض
    await pool.query('CREATE INDEX IF NOT EXISTS idx_products_offers ON products(created_at DESC) WHERE old_price IS NOT NULL AND old_price > price;');
    // ربط رسائل إنستغرام المباشرة (Instagram Messaging API) — لكل متجر حسابه:
    // معرّف حساب إنستغرام Business + الصفحة المربوطة + توكن الصفحة (مشفّر).
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS ig_user_id VARCHAR(60) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS ig_username VARCHAR(120) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS ig_page_id VARCHAR(60) DEFAULT '';");
    await pool.query("ALTER TABLE stores ADD COLUMN IF NOT EXISTS ig_access_token TEXT DEFAULT '';");
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS ig_connected BOOLEAN NOT NULL DEFAULT false;');
    // محادثات إنستغرام: صف لكل (متجر، مُرسِل) — يحمل آخر رسالة وعدّاد غير المقروء
    // وربطاً بالطلب إن حُوّلت المحادثة لطلب. نطابق المتجر بحساب إنستغرام في الـ webhook.
    await pool.query(`CREATE TABLE IF NOT EXISTS ig_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      ig_sender_id VARCHAR(60) NOT NULL,
      customer_name VARCHAR(120) DEFAULT '',
      customer_username VARCHAR(120) DEFAULT '',
      last_message TEXT DEFAULT '',
      last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      unread INTEGER NOT NULL DEFAULT 0,
      order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (store_id, ig_sender_id)
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ig_conv_store ON ig_conversations(store_id, last_at DESC);');
    // رسائل المحادثة (واردة/صادرة) — mid فريد لمنع تكرار نفس رسالة الـ webhook
    await pool.query(`CREATE TABLE IF NOT EXISTS ig_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES ig_conversations(id) ON DELETE CASCADE,
      mid VARCHAR(255) UNIQUE,
      direction VARCHAR(4) NOT NULL,
      text TEXT DEFAULT '',
      attachment_url TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ig_msg_conv ON ig_messages(conversation_id, created_at);');
  } catch (err) {
    console.error('⚠️ تعذّر تطبيق الترقيات:', err.message);
  }
}

// ترقية المحاسبة، منفصلة عن ensureColumns عمداً: تلك كتلة try واحدة، فأي جملة
// قديمة تفشل فيها تُسقط كل ما بعدها بصمت. عمود التكلفة وجدول المصاريف يقرأهما
// الكود مباشرةً، وغيابهما يُسقط قائمة الطلبات بخطأ خادم — فلا يصحّ أن يتعلّق
// وجودهما بنجاح ترقية لا علاقة لها بهما.
async function ensureAccounting() {
  const steps = [
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2);',
    `CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      category VARCHAR(30) NOT NULL DEFAULT 'other',
      amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
      note VARCHAR(200) DEFAULT '',
      spent_at DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    'CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON expenses(store_id, spent_at DESC);',
    // تسوية التحصيل: متى استلمتِ ثمن الطلب من شركة التوصيل (NULL = ما زال عندها)
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;",
    'CREATE INDEX IF NOT EXISTS idx_orders_collected ON orders(store_id, collected_at);',
    // فئات المنتجات: العمود بدأ نوعاً مُعدّداً (men/women/kids/accessories) ثم
    // صار نصّاً حرّاً بفئات أزياء. التحويل وإعادة التعيين كانا في schema.sql
    // وحدها ولا تُنفَّذ عند الإقلاع، فبقيت منتجات بقيمٍ قديمة لا تطابق أي زرّ
    // فئة — وهو سبب اختفاء العبايات تحت زرّها.
    `DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category' AND data_type <> 'text'
  ) THEN
    ALTER TABLE products ALTER COLUMN category TYPE TEXT USING category::text;
  END IF;
END $;`,
    "ALTER TABLE products ALTER COLUMN category SET DEFAULT 'dress';",
    `UPDATE products SET category = CASE category
       WHEN 'women' THEN 'dress'
       WHEN 'men' THEN 'set'
       WHEN 'kids' THEN 'abaya'
       WHEN 'accessories' THEN 'hijab'
       ELSE category END
     WHERE category IN ('women', 'men', 'kids', 'accessories');`,
    // إشراف المدير: إخفاء منتج بسبب + سجلّ الأفعال
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS hidden_reason VARCHAR(200) DEFAULT '';",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES users(id) ON DELETE SET NULL;",
    "CREATE INDEX IF NOT EXISTS idx_products_hidden ON products(hidden_at);",
    `CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_email VARCHAR(160) NOT NULL DEFAULT '',
  action VARCHAR(40) NOT NULL,
  target_type VARCHAR(20) NOT NULL DEFAULT '',
  target_id VARCHAR(80) NOT NULL DEFAULT '',
  target_label VARCHAR(200) NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
    'CREATE INDEX IF NOT EXISTS idx_admin_actions_time ON admin_actions(created_at DESC);',
    // إيقاف إداريّ مؤقّت بسبب: كان البديل إمّا إيقاف الاشتراك (فيظهر «منتهٍ»
    // وتظنّ صاحبته أنّ خطأً وقع) أو حذف الحساب كلّه. لا شيء بينهما.
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;',
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason VARCHAR(200) DEFAULT '';",
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id) ON DELETE SET NULL;',
  ];
  // كل جملة على حدة: فشل واحدة لا يمنع البقية
  for (const sql of steps) {
    try { await pool.query(sql); } catch (err) { console.error('⚠️ ترقية محاسبة:', err.message); }
  }
}

function start() {
  app.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
  });
  // مزامنة خلفية لحالات الشحنات — احتياط عن الـ webhooks (هي المصدر الفوري الأساسي).
  // مهمّ لتوفير حوسبة Neon المجانية: كل تشغيلة توقظ القاعدة (Neon ينام بلا نشاط)، فكل
  // 10 دقائق كان يبقيها صاحية ~نصف الوقت ويستنزف الحد الشهري. رفعناها للافتراضي 30
  // دقيقة (قابل للضبط عبر BG_SYNC_MINUTES) — تبقى الحالات محدّثة عبر الـwebhooks لحظياً،
  // والمزامنة مجرّد شبكة أمان أندر. النتيجة: هبوط كبير في ساعات الحوسبة.
  const SYNC_MS = Math.max(5, Number(process.env.BG_SYNC_MINUTES) || 30) * 60 * 1000;
  setInterval(() => { syncAllConnectedStores().catch(() => {}); }, SYNC_MS);
  setTimeout(() => { syncAllConnectedStores().catch(() => {}); }, 45 * 1000); // تشغيلة أولى بعد الإقلاع
  setInterval(() => { syncAllEpsStores().catch(() => {}); }, SYNC_MS);
  setTimeout(() => { syncAllEpsStores().catch(() => {}); }, 60 * 1000);
  setInterval(() => { syncAllGoboxStores().catch(() => {}); }, SYNC_MS);
  setTimeout(() => { syncAllGoboxStores().catch(() => {}); }, 75 * 1000);
  // إشعار المالك عن السلات المتروكة الجديدة — أندر أيضاً لتوفير الحوسبة (تأخير مقبول)
  setInterval(() => { notifyAbandonedCheckouts().catch(() => {}); }, SYNC_MS);
  setTimeout(() => { notifyAbandonedCheckouts().catch(() => {}); }, 2 * 60 * 1000);
}

// تنفيذ schema.sql كاملاً عند الإقلاع.
//
// ٤٠ جملة ترقية كانت تعيش في المخطّط وحده، وهو لا يُنفَّذ إلا يدوياً — فكلّما
// سبق الكودُ قاعدةَ البيانات ظهر عطبٌ صامت: سقطت قائمة الطلبات مرّةً، واختفت
// منتجات العبايات مرّةً لأن قيم الفئات القديمة لم تُعَد تعيينها. المخطّط كلّه
// إضافيّ ومحصّن (IF NOT EXISTS)، وجملته الوحيدة التي تلمس بيانات لها WHERE
// يستنفد نفسه — فإعادة تنفيذه بلا أثر، والنشر يصير يُصلح نفسه.
async function ensureSchemaFile() {
  const LOCK = 918273645; // قفل استشاري: نسختان تُقلعان معاً لا تتزاحمان على ALTER
  let client;
  try {
    client = await pool.connect();
    const got = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK]);
    if (!got.rows[0].ok) return; // نسخة أخرى تُهيّئ الآن
    try {
      const dir = path.dirname(fileURLToPath(import.meta.url));
      await client.query(fs.readFileSync(path.join(dir, 'config/schema.sql'), 'utf-8'));
      console.log('✅ المخطّط محدَّث.');
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK]);
    }
  } catch (err) {
    // لا نُسقط الخادم: متجرٌ يعمل بميزة ناقصة أفضل من متجرٍ مُطفأ
    console.error('⚠️ تعذّرت تهيئة المخطّط:', err.message);
  } finally {
    client?.release();
  }
}

// الترقية التلقائية على الإنتاج فقط (Render). محلياً نشغّل مباشرة بلا لمس قاعدة البيانات.
if (process.env.NODE_ENV === 'production') {
  // .catch إضافي: لو رجعت ensureColumns رفضاً لأي سبب نادر، نسجّله ونُقلع بأي حال —
  // فلا يبقى رفض غير ملتقَط يوقف العملية عند الإقلاع.
  ensureSchemaFile()
    .then(ensureColumns)
    .catch((e) => console.error('⚠️ الترقيات:', e?.message))
    .then(ensureAccounting)
    .finally(start);
} else {
  start();
}

export default app;
