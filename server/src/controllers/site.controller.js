import { query } from '../config/db.js';
import { sanitizeBanners } from './store.controller.js';

// إعدادات الموقع العامة (صف واحد id=1) — يتحكّم بها المدير العام.
async function readSettings() {
  const r = await query('SELECT home_banners, announcement, announcement_en, collections FROM site_settings WHERE id = 1');
  const row = r.rows[0];
  return {
    banners: Array.isArray(row?.home_banners) ? row.home_banners : [],
    announcement: row?.announcement || '',
    announcementEn: row?.announcement_en || '',
    collections: Array.isArray(row?.collections) ? row.collections : [],
  };
}

// تنقية المجموعات: عنوان + صورة + كلمة بحث. لا نقبل روابط حرّة (نبني /search بأنفسنا)
// فلا يمكن حقن رابط خارجي أو javascript: من لوحة الإدارة.
const MAX_COLLECTIONS = 8;
const sanitizeCollections = (list) => {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, MAX_COLLECTIONS)
    .map((c) => ({
      title: String(c?.title ?? '').slice(0, 60).trim(),
      titleEn: String(c?.titleEn ?? '').slice(0, 60).trim(),
      image: /^https?:\/\//i.test(String(c?.image ?? '')) ? String(c.image).slice(0, 500) : '',
      q: String(c?.q ?? '').slice(0, 60).trim(),
    }))
    .filter((c) => c.title && c.q); // بلا عنوان أو كلمة بحث لا معنى للبطاقة
};

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
    const collections = req.body.collections === undefined ? cur.collections : sanitizeCollections(req.body.collections);
    await query(
      `INSERT INTO site_settings (id, home_banners, announcement, announcement_en, collections, updated_at)
       VALUES (1, $1::jsonb, $2, $3, $4::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET home_banners = EXCLUDED.home_banners,
         announcement = EXCLUDED.announcement, announcement_en = EXCLUDED.announcement_en,
         collections = EXCLUDED.collections, updated_at = now()`,
      [JSON.stringify(banners), announcement, announcementEn, JSON.stringify(collections)]
    );
    res.json({ banners, announcement, announcementEn, collections });
  } catch (err) {
    next(err);
  }
}

// ───── اشتراك النشرة (عام) ─────
// نقبل بريداً أو رقم واتساب بحقل واحد. لا نخزّن اسماً ولا أي بيانات أخرى — وسيلة
// التواصل ونوعها فقط. التكرار يُبتلع بهدوء (ON CONFLICT) فلا نكشف من اشترك سابقاً.
const DIGITS = /^\+?[\d\s-]{9,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export async function subscribeNewsletter(req, res, next) {
  try {
    const raw = String(req.body?.contact ?? '').trim().slice(0, 120);
    if (!raw) return res.status(400).json({ error: 'أدخلي بريدك أو رقمك.' });

    let contact = raw;
    let kind;
    if (EMAIL.test(raw)) {
      kind = 'email';
      contact = raw.toLowerCase();
    } else if (DIGITS.test(raw)) {
      kind = 'phone';
      contact = raw.replace(/[\s-]/g, ''); // نوحّد الصيغة كي لا يتكرّر الرقم بأشكال مختلفة
    } else {
      return res.status(400).json({ error: 'تأكّدي من البريد أو الرقم.' });
    }

    await query(
      'INSERT INTO subscribers (contact, kind) VALUES ($1, $2) ON CONFLICT (contact) DO NOTHING',
      [contact, kind]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// قائمة مشتركي النشرة (مدير) — غير مشتركي الاشتراكات المدفوعة
export async function listNewsletter(_req, res, next) {
  try {
    const r = await query('SELECT contact, kind, created_at FROM subscribers ORDER BY created_at DESC LIMIT 5000');
    res.json({ subscribers: r.rows, count: r.rowCount });
  } catch (err) {
    next(err);
  }
}
