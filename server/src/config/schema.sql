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
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tiktok        VARCHAR(120) DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS theme_color   VARCHAR(20)  DEFAULT '#d4af37';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_info TEXT DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS payment_info  TEXT DEFAULT '';

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
