# 👗 متجر الأناقة — منصة متاجر ملابس إلكترونية متكاملة

تطبيق ويب **Full-Stack** آمن وجاهز للنشر: كل مستخدم ينشئ حسابه ومتجره الخاص، يضيف منتجاته،
ويحصل على رابط عام ثابت يشاركه مع زبائنه (يعمل بدون تسجيل دخول)، مع دعم كامل للعربية والإنجليزية
وتحسين الظهور في محركات البحث (SEO + IndexNow).

## 🧱 التقنيات

| الطبقة | التقنية |
|--------|---------|
| الواجهة | React + Vite + Tailwind CSS + React Router + i18next + react-helmet-async |
| الخادم | Node.js + Express |
| قاعدة البيانات | PostgreSQL |
| الأمان | bcrypt, JWT (httpOnly cookie), Helmet, rate-limit, CSRF, express-validator |

## 📁 هيكل المشروع

```
.
├── client/        ← واجهة React + Vite
│   ├── src/
│   │   ├── api/         (عميل axios + CSRF)
│   │   ├── components/  (Navbar, ProductCard, Seo, ...)
│   │   ├── context/     (AuthContext)
│   │   ├── locales/     (ar.json, en.json)
│   │   ├── pages/       (Home, Login, Dashboard, StorePage, ...)
│   │   └── i18n.js
│   └── vercel.json
├── server/        ← خادم Express + PostgreSQL
│   ├── src/
│   │   ├── config/      (db.js, schema.sql, initDb.js)
│   │   ├── controllers/ (auth, store, product, public, seo)
│   │   ├── middleware/  (auth, csrf, validate, errorHandler)
│   │   ├── routes/
│   │   ├── utils/       (slug, indexnow)
│   │   ├── seed.js      (بيانات تجريبية)
│   │   └── index.js
│   └── .env.example
└── README.md
```

---

## 🔐 ملخّص ميزات الأمان (المُطبّقة فعلياً)

- **تشفير كلمات المرور** بـ bcrypt (12 جولة) — لا تُخزَّن أبداً كنص واضح.
- **JWT داخل httpOnly cookie** مع صلاحية محددة (`JWT_EXPIRES_IN`)، لا يصل إليه JavaScript.
- **اشتراط كلمة مرور قوية**: 8 أحرف على الأقل + حرف + رقم + رمز.
- **التحقق من المدخلات** على الخادم (express-validator) وعلى الواجهة.
- **منع SQL Injection** عبر *parameterized queries* في كل الاستعلامات.
- **حماية XSS** (React يهرّب المخرجات افتراضياً) + **Helmet** لرؤوس HTTP الآمنة.
- **حماية CSRF** بأسلوب double-submit token.
- **Rate limiting** عام وصارم على مسارات الدخول/التسجيل.
- **صلاحيات صارمة**: كل مستخدم يعدّل/يحذف منتجاته ومتجره فقط (فحص ملكية في كل عملية).
- **إخفاء رسائل الأخطاء الحساسة** عن المستخدم (معالج أخطاء مركزي).
- **الأسرار في `.env`** فقط، وHTTPS عند النشر.

---

## 💻 أولاً: التشغيل المحلي

### المتطلبات
- Node.js 18 أو أحدث
- PostgreSQL مثبّت ويعمل محلياً

### 1) قاعدة البيانات
أنشئ قاعدة بيانات فارغة:
```sql
CREATE DATABASE clothing_store;
```

### 2) إعداد الخادم
```bash
cd server
copy .env.example .env       # على ويندوز (أو cp على ماك/لينكس)
```
افتح `server/.env` واضبط:
- `DATABASE_URL` ببيانات PostgreSQL لديك.
- `JWT_SECRET` بقيمة عشوائية طويلة. ولّدها بـ:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

ثم:
```bash
npm install
npm run db:init     # ينشئ الجداول
npm run db:seed     # يضيف متجرين ومنتجات تجريبية
npm run dev         # يشغّل الخادم على http://localhost:5000
```

### 3) إعداد الواجهة (في نافذة طرفية أخرى)
```bash
cd client
copy .env.example .env       # اتركه فارغاً محلياً (وكيل Vite يتكفّل بالباقي)
npm install
npm run dev                  # يفتح http://localhost:5173
```

> أو من جذر المشروع: `npm run install:all` ثم شغّل `npm run dev:server` و`npm run dev:client`.

### 🔑 حساب تجريبي جاهز
- البريد: `noor@example.com`
- كلمة المرور: `Passw0rd!`

(يوجد أيضاً `sami@example.com` بنفس كلمة المرور)

---

## 🌍 ثانياً: النشر على الإنترنت (رابط عام)

الخطة: **قاعدة البيانات + الخادم على Render**، و**الواجهة على Vercel**.

### أ) قاعدة بيانات PostgreSQL على Render
1. ادخل [render.com](https://render.com) ← **New → PostgreSQL**.
2. بعد الإنشاء، انسخ **Internal Database URL** (أو External).

### ب) نشر الخادم (Web Service) على Render
1. ارفع المشروع إلى GitHub.
2. Render ← **New → Web Service** ← اربط المستودع.
3. الإعدادات:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. أضف **Environment Variables**:
   | المفتاح | القيمة |
   |---------|--------|
   | `DATABASE_URL` | رابط قاعدة Render |
   | `PGSSL` | `true` |
   | `JWT_SECRET` | قيمة عشوائية طويلة |
   | `NODE_ENV` | `production` |
   | `CLIENT_URL` | رابط واجهتك على Vercel (مثلاً `https://mystore.vercel.app`) |
   | `PUBLIC_SITE_URL` | نفس رابط Vercel |
   | `COOKIE_SECURE` | `true` |
   | `COOKIE_SAMESITE` | `none` |
   | `INDEXNOW_KEY` | مفتاح عشوائي (اختياري، انظر قسم IndexNow) |
5. بعد أول نشر، شغّل تهيئة الجداول والبيانات من **Shell** في Render:
   ```bash
   npm run db:init
   npm run db:seed
   ```
6. انسخ رابط الخادم (مثلاً `https://my-api.onrender.com`).

### ج) نشر الواجهة على Vercel
1. [vercel.com](https://vercel.com) ← **Add New → Project** ← اربط نفس المستودع.
2. الإعدادات:
   - **Root Directory:** `client`
   - **Framework Preset:** Vite (يُكتشف تلقائياً)
3. أضف **Environment Variable**:
   - `VITE_API_URL` = رابط خادمك على Render (مثلاً `https://my-api.onrender.com`)
4. عدّل `client/vercel.json` واستبدل `REPLACE-WITH-YOUR-API.onrender.com` برابط خادمك،
   حتى يعمل `‎/sitemap.xml` و`‎/robots.txt` على دومين الواجهة.
5. انشر، واحصل على رابطك العام 🎉

### د) ربط دومين خاص (اختياري)
1. في Vercel ← مشروعك ← **Settings → Domains → Add** ← اكتب دومينك.
2. أضف سجلات DNS التي يعرضها Vercel عند مزوّد الدومين (CNAME / A record).
3. حدّث `CLIENT_URL` و`PUBLIC_SITE_URL` في Render إلى الدومين الجديد، ثم أعد النشر.

> روابط المتاجر ستكون بالشكل: `https://دومينك/store/boutique-noor`

---

## 🔎 ثالثاً: تسريع الظهور في بحث جوجل (SEO)

التطبيق يولّد تلقائياً:
- `‎/sitemap.xml` ديناميكي يضم كل المتاجر والمنتجات.
- `‎/robots.txt` يشير إلى الـ sitemap.
- **meta tags + Open Graph ديناميكية** لكل متجر ومنتج (عبر react-helmet-async).
- دعم **IndexNow** لإخطار محركات البحث فور إضافة متجر/منتج.

### 1) تسجيل الموقع في Google Search Console
1. ادخل [search.google.com/search-console](https://search.google.com/search-console).
2. **Add property → URL prefix** ← أدخل رابط موقعك الكامل (دومين Vercel أو دومينك).
3. أثبت الملكية بأسهل طريقة: **HTML tag** — انسخ وسم `<meta name="google-site-verification" ...>`
   وضعه في `client/index.html` داخل `<head>`، ثم أعد النشر، ثم اضغط **Verify**.

### 2) رفع ملف sitemap.xml
1. داخل Search Console ← **Sitemaps** (من القائمة الجانبية).
2. في خانة "Add a new sitemap" اكتب: `sitemap.xml` ثم **Submit**.
3. سيقرأ جوجل كل صفحات متاجرك ومنتجاتك.

### 3) طلب فهرسة فورية (لأهم الصفحات)
1. Search Console ← **URL Inspection** (الشريط العلوي).
2. الصق رابط الصفحة (مثلاً رابط متجرك `https://دومينك/store/boutique-noor`).
3. اضغط **Request Indexing**. كرّرها لصفحاتك المهمة لتسريع ظهورها.

### 4) تفعيل IndexNow (فهرسة فورية تلقائية — اختياري لكن مفيد)
1. ولّد مفتاحاً:
   ```bash
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```
2. ضع القيمة في متغير `INDEXNOW_KEY` على Render.
3. أنشئ ملفاً باسم `<المفتاح>.txt` (نفس قيمة المفتاح كاسم وكمحتوى) داخل `client/public/`
   ثم أعد نشر الواجهة، ليصبح متاحاً على `https://دومينك/<المفتاح>.txt`.
4. من الآن، عند إضافة/تعديل متجر أو منتج (في وضع production) يُرسل التطبيق تنبيهاً تلقائياً
   إلى IndexNow ليُفهرَس بسرعة.

> ملاحظة عن SSR: الواجهة SPA لكنها تضخّ meta/OG ديناميكية لكل صفحة، وجوجل ينفّذ JavaScript
> ويفهرس المحتوى. مع الـ sitemap وIndexNow وطلب الفهرسة اليدوي تظهر صفحاتك بسرعة.
> لو رغبت لاحقاً بـ SSR كامل يمكن ترقية الواجهة إلى Next.js دون تغيير الخادم.

---

## 🎨 المظهر واللغات
- خطوط أنيقة: **Tajawal/Cairo** للعربية و**Inter/Poppins** للإنجليزية.
- خلفية فاخرة بتدرّجات ناعمة وبطاقات **glassmorphism** وأنيميشن خفيفة.
- تصميم متجاوب بالكامل (موبايل/لابتوب).
- زر تبديل اللغة بالأعلى: العربية **RTL** والإنجليزية **LTR**، ويُحفظ الاختيار تلقائياً.

---

## 🗺️ أهم المسارات (Routes)

| الواجهة | الوصف |
|---------|-------|
| `/` | الصفحة الرئيسية (متاجر ومنتجات مميزة) |
| `/register` `/login` | الحسابات |
| `/dashboard` | لوحة التحكم (محمية) |
| `/store/:slug` | المتجر العام (يعمل بدون تسجيل) |
| `/product/:id` | تفاصيل المنتج |

| الـ API | الوصف |
|---------|-------|
| `POST /api/auth/register \| login \| logout`, `GET /api/auth/me` | المصادقة |
| `GET \| PUT /api/stores/me` | إعدادات المتجر |
| `GET \| POST /api/products`, `PUT \| DELETE /api/products/:id` | منتجاتي (CRUD) |
| `GET /api/public/home \| store/:slug \| product/:id` | بيانات عامة |
| `GET /sitemap.xml`, `/robots.txt` | SEO |
```
