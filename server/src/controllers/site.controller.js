import { query } from '../config/db.js';
import { sanitizeBanners } from './store.controller.js';

// إعدادات الموقع العامة (صف واحد id=1) — يتحكّم بها المدير العام.
async function readSettings() {
  const r = await query('SELECT home_banners, announcement, announcement_en FROM site_settings WHERE id = 1');
  const row = r.rows[0];
  return {
    banners: Array.isArray(row?.home_banners) ? row.home_banners : [],
    announcement: row?.announcement || '',
    announcementEn: row?.announcement_en || '',
  };
}

// حدّ أمان لطول الإعلان — سطر لكل رسالة، ويظهر متحرّكاً بأعلى الصفحة
const MAX_ANNOUNCEMENT = 400;
const cleanAnnouncement = (v) => String(v ?? '').slice(0, MAX_ANNOUNCEMENT).trim();

// جلب إعدادات الصفحة الرئيسية للموقع (مدير)
export async function getSiteBanners(_req, res, next) {
  try {
    res.json(await readSettings());
  } catch (err) {
    next(err);
  }
}

// تحديث بانرات الصفحة الرئيسية للموقع (مدير)
export async function updateSiteBanners(req, res, next) {
  try {
    const banners = sanitizeBanners(req.body.banners);
    // الإعلان اختياري: إن لم يُرسل الحقل نُبقي المحفوظ كما هو (لا نمسحه بحفظ البانرات وحدها)
    const cur = await readSettings();
    const announcement = req.body.announcement === undefined ? cur.announcement : cleanAnnouncement(req.body.announcement);
    const announcementEn = req.body.announcementEn === undefined ? cur.announcementEn : cleanAnnouncement(req.body.announcementEn);
    await query(
      `INSERT INTO site_settings (id, home_banners, announcement, announcement_en, updated_at)
       VALUES (1, $1::jsonb, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET home_banners = EXCLUDED.home_banners,
         announcement = EXCLUDED.announcement, announcement_en = EXCLUDED.announcement_en, updated_at = now()`,
      [JSON.stringify(banners), announcement, announcementEn]
    );
    res.json({ banners, announcement, announcementEn });
  } catch (err) {
    next(err);
  }
}
