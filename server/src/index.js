import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import storeRoutes from './routes/store.routes.js';
import productRoutes from './routes/product.routes.js';
import publicRoutes from './routes/public.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import orderRoutes from './routes/order.routes.js';
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

// مسارات SEO (على الجذر)
app.get('/robots.txt', robots);
app.get('/sitemap.xml', sitemap);
app.get('/:key([a-f0-9]+\\.txt)', indexNowKey); // ملف مفتاح IndexNow

// 404 ومعالج الأخطاء
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
});

export default app;
