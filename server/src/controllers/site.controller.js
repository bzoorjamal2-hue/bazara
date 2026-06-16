import { query } from '../config/db.js';
import { sanitizeBanners } from './store.controller.js';

// إعدادات الموقع العامة (صف واحد id=1) — يتحكّم بها المدير العام.
async function readBanners() {
  const r = await query('SELECT home_banners FROM site_settings WHERE id = 1');
  const row = r.rows[0];
  return Array.isArray(row?.home_banners) ? row.home_banners : [];
}

// جلب بانرات الصفحة الرئيسية للموقع (مدير)
export async function getSiteBanners(_req, res, next) {
  try {
    res.json({ banners: await readBanners() });
  } catch (err) {
    next(err);
  }
}

// تحديث بانرات الصفحة الرئيسية للموقع (مدير)
export async function updateSiteBanners(req, res, next) {
  try {
    const banners = sanitizeBanners(req.body.banners);
    await query(
      `INSERT INTO site_settings (id, home_banners, updated_at)
       VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET home_banners = EXCLUDED.home_banners, updated_at = now()`,
      [JSON.stringify(banners)]
    );
    res.json({ banners });
  } catch (err) {
    next(err);
  }
}
