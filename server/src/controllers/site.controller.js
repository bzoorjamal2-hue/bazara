import { query } from '../config/db.js';
import { sanitizeBanners } from './store.controller.js';
import { clearPublicCache } from '../middleware/cache.js';

// إعدادات الموقع العامة (صف واحد id=1) — يتحكّم بها المدير العام.
async function readSettings() {
  const r = await query('SELECT home_banners, announcement, announcement_en, collections, lookbook, instagram, facebook, platform_categories FROM site_settings WHERE id = 1');
  const row = r.rows[0];
  return {
    banners: Array.isArray(row?.home_banners) ? row.home_banners : [],
    announcement: row?.announcement || '',
    announcementEn: row?.announcement_en || '',
    collections: Array.isArray(row?.collections) ? row.collections : [],
    lookbook: row?.lookbook && typeof row.lookbook === 'object' ? row.lookbook : {},
    instagram: row?.instagram || '',
    facebook: row?.facebook || '',
    // كائن لا مصفوفة: { extra, hidden }
    platformCategories: (row?.platform_categories && typeof row.platform_categories === 'object')
      ? { extra: row.platform_categories.extra || [], hidden: row.platform_categories.hidden || [] }
      : { extra: [], hidden: [] },
  };
}

// حساب سوشيال المنصّة: اسم مستخدم أو رابط — نقصّ الطول ونشذّب المسافات فقط.
// الفوتر يبني رابط instagram.com/<user> بنفسه، والمدخل من المدير الموثوق (لوحة محميّة).
const cleanHandle = (v) => String(v ?? '').trim().slice(0, 200);

// تنقية المجموعات: عنوان + صورة + كلمة بحث. لا نقبل روابط حرّة (نبني /search بأنفسنا)
// فلا يمكن حقن رابط خارجي أو javascript: من لوحة الإدارة.
const MAX_COLLECTIONS = 8;
// فئات المنصّة. المفتاح يدخل في الروابط (/category/:key) وفي استعلامات SQL،
// فنقصره على حروف لاتينية صغيرة وأرقام وشرطات ونمنع الاصطدام بالمدمجة.
const BUILTIN_CATS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];
const sanitizePlatformCats = (v) => {
  const extraIn = Array.isArray(v?.extra) ? v.extra : [];
  const seen = new Set(BUILTIN_CATS);
  const extra = [];
  for (const c of extraIn.slice(0, 12)) {
    const key = String(c?.key ?? '').trim().toLowerCase();
    if (!/^[a-z0-9-]{2,24}$/.test(key) || seen.has(key)) continue;
    seen.add(key);
    extra.push({
      key,
      name: String(c?.name ?? '').slice(0, 40).trim(),
      nameEn: String(c?.nameEn ?? '').slice(0, 40).trim(),
      image: /^https?:\/\//i.test(String(c?.image ?? '')) ? String(c.image).slice(0, 500) : '',
    });
  }
  const hidden = (Array.isArray(v?.hidden) ? v.hidden : [])
    .map((k) => String(k).trim().toLowerCase())
    .filter((k) => BUILTIN_CATS.includes(k));
  return { extra: extra.filter((c) => c.name), hidden };
};

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
// اللوك بوك: صورة إطلالة + معرّفات قطعها. لا نقبل إلا http(s) وأعداداً صحيحة.
const sanitizeLookbook = (v) => {
  if (!v || typeof v !== 'object') return {};
  const image = /^https?:///i.test(String(v.image ?? '')) ? String(v.image).slice(0, 500) : '';
  if (!image) return {}; // بلا صورة لا معنى للوك بوك
  return {
    image,
    title: String(v.title ?? '').slice(0, 60).trim(),
    titleEn: String(v.titleEn ?? '').slice(0, 60).trim(),
    productIds: (Array.isArray(v.productIds) ? v.productIds : [])
      .map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0).slice(0, 12),
  };
};

export async function updateSiteBanners(req, res, next) {
  try {
    const banners = sanitizeBanners(req.body.banners);
    // الإعلان اختياري: إن لم يُرسل الحقل نُبقي المحفوظ كما هو (لا نمسحه بحفظ البانرات وحدها)
    const cur = await readSettings();
    const announcement = req.body.announcement === undefined ? cur.announcement : cleanAnnouncement(req.body.announcement);
    const announcementEn = req.body.announcementEn === undefined ? cur.announcementEn : cleanAnnouncement(req.body.announcementEn);
    const collections = req.body.collections === undefined ? cur.collections : sanitizeCollections(req.body.collections);
    const lookbook = req.body.lookbook === undefined ? cur.lookbook : sanitizeLookbook(req.body.lookbook);
    const instagram = req.body.instagram === undefined ? cur.instagram : cleanHandle(req.body.instagram);
    const facebook = req.body.facebook === undefined ? cur.facebook : cleanHandle(req.body.facebook);
    const platformCategories = req.body.platformCategories === undefined
      ? cur.platformCategories
      : sanitizePlatformCats(req.body.platformCategories);
    await query(
      `INSERT INTO site_settings (id, home_banners, announcement, announcement_en, collections, lookbook, instagram, facebook, platform_categories, updated_at)
       VALUES (1, $1::jsonb, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET home_banners = EXCLUDED.home_banners,
         announcement = EXCLUDED.announcement, announcement_en = EXCLUDED.announcement_en,
         collections = EXCLUDED.collections, lookbook = EXCLUDED.lookbook,
         instagram = EXCLUDED.instagram, facebook = EXCLUDED.facebook,
         platform_categories = EXCLUDED.platform_categories, updated_at = now()`,
      [JSON.stringify(banners), announcement, announcementEn, JSON.stringify(collections), JSON.stringify(lookbook), instagram, facebook, JSON.stringify(platformCategories)]
    );
    clearPublicCache(); // إبطال كاش الذاكرة فوراً (/home و/site-info) فتظهر التعديلات حالاً
    res.json({ banners, announcement, announcementEn, collections, lookbook, instagram, facebook, platformCategories });
  } catch (err) {
    next(err);
  }
}

// معلومات المنصّة العامة (حسابات السوشيال) — للفوتر على كل الصفحات، بلا مصادقة.
export async function getSiteInfo(_req, res, next) {
  try {
    const s = await readSettings();
    res.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
    res.json({ instagram: s.instagram, facebook: s.facebook, platformCategories: s.platformCategories });
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
