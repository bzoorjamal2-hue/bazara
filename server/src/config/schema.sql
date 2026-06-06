-- ============================================================
--  مخطط قاعدة البيانات لمتجر الملابس الإلكتروني
--  idempotent: يصلح للتثبيت الجديد وللترقية (ADD COLUMN IF NOT EXISTS)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone      VARCHAR(40) DEFAULT '';
-- حقول الاشتراك (Stripe)
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status    VARCHAR(20) NOT NULL DEFAULT 'inactive'; -- inactive|active|past_due|canceled
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan      VARCHAR(20);   -- monthly|yearly
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end     TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscriber_code        VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;
-- استعادة كلمة المرور
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;

-- جدول المتاجر (متجر واحد لكل مستخدم)
CREATE TABLE IF NOT EXISTS stores (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(160) NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    logo_url    TEXT DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone         VARCHAR(40)  DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS whatsapp      VARCHAR(40)  DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS instagram     VARCHAR(120) DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS facebook      VARCHAR(200) DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tiktok        VARCHAR(120) DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS theme_color   VARCHAR(20)  DEFAULT '#d4af37';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_info TEXT DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS payment_info  TEXT DEFAULT '';
-- شرايح السلايدر (بانرات العرض) القابلة للتخصيص من صاحب المتجر
ALTER TABLE stores ADD COLUMN IF NOT EXISTS banners       JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);

-- فئات المنتجات المسموحة
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category') THEN
        CREATE TYPE product_category AS ENUM ('men', 'women', 'kids', 'accessories');
    END IF;
END$$;

-- جدول المنتجات
CREATE TABLE IF NOT EXISTS products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,
    price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    description TEXT DEFAULT '',
    size        VARCHAR(50) DEFAULT '',
    color       VARCHAR(50) DEFAULT '',
    category    product_category NOT NULL DEFAULT 'men',
    image_url   TEXT DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS images    TEXT[]        DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS old_price NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock     INTEGER; -- NULL = متوفّر دائماً، 0 = نفد
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT ''; -- رابط فيديو المنتج (اختياري)

-- تحويل الفئة إلى نص حر (فئات أزياء مخصّصة) + إعادة تعيين القيم القديمة
ALTER TABLE products ALTER COLUMN category TYPE TEXT USING category::text;
ALTER TABLE products ALTER COLUMN category SET DEFAULT 'dress';
UPDATE products SET category = CASE category
    WHEN 'women' THEN 'dress'
    WHEN 'men' THEN 'set'
    WHEN 'kids' THEN 'abaya'
    WHEN 'accessories' THEN 'hijab'
    ELSE category END
  WHERE category IN ('women', 'men', 'kids', 'accessories');

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);

-- جدول التقييمات والمراجعات (يكتبها أي زائر)
CREATE TABLE IF NOT EXISTS reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

-- طلبات الاشتراك (تفعيل يدوي + دفع محلي)
CREATE TABLE IF NOT EXISTS subscription_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan        VARCHAR(20) NOT NULL,                 -- monthly|yearly
    method      VARCHAR(40) DEFAULT '',               -- payoneer|bank|wallet...
    reference   TEXT DEFAULT '',                      -- رقم العملية/ملاحظة من المشترك
    status      VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|approved|rejected
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_subreq_user ON subscription_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_subreq_status ON subscription_requests(status);

-- إعدادات المنصة (يحرّرها المدير من اللوحة) مثل تعليمات الدفع
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
);

-- أكواد تفعيل الاشتراك (يولّدها المدير، يدخلها المشترك بعد التحويل)
CREATE TABLE IF NOT EXISTS activation_codes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(30) UNIQUE NOT NULL,
    plan       VARCHAR(20) NOT NULL,            -- monthly|yearly
    used       BOOLEAN NOT NULL DEFAULT false,
    used_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_codes_used ON activation_codes(used);

-- الطلبات (الدفع بالبطاقة عبر Lahza)
CREATE TABLE IF NOT EXISTS orders (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_name  VARCHAR(100) DEFAULT '',
    customer_email VARCHAR(255) DEFAULT '',
    customer_phone VARCHAR(40)  DEFAULT '',
    items          JSONB NOT NULL DEFAULT '[]',
    total          NUMERIC(10,2) NOT NULL,
    currency       VARCHAR(10) NOT NULL DEFAULT 'ILS',
    status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|paid|failed
    reference      TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
