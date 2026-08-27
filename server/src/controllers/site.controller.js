import { query } from '../config/db.js';
import { sanitizeBanners } from './store.controller.js';
import { clearPublicCache } from '../middleware/cache.js';
import { logAdmin } from '../utils/adminLog.js';
import { activeStoreSql } from '../utils/subscription.js';

// إعدادات الموقع العامة (صف واحد id=1) — يتحكّم بها المدير العام.
async function readSettings() {
  const r = await query('SELECT home_banners, announcement, announcement_en, collections, lookbook, instagram, facebook, platform_categories, landing FROM site_settings WHERE id = 1');
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
    landing: (row?.landing && typeof row.landing === 'object' && !Array.isArray(row.landing)) ? row.landing : {},
  };
}

// ───────────────── صفحة الواجهة (الهبوط) ─────────────────
// كلّ نصّ فيها يحرّره المدير. لا نخزّن قيماً افتراضية بقاعدة البيانات: الفارغ
// يعني «استخدم النصّ المترجَم الأصلي»، فتبقى الصفحة كاملةً قبل أن يفتح أحدٌ
// المحرّر، وتبقى ثنائية اللغة إلى أن يُكتب نصٌّ مخصّص.
const txt = (v, max = 200) => String(v ?? '').trim().slice(0, max);
// صورة: رابط https أو صورة مضمّنة (base64) — لا javascript: ولا بروتوكول حرّ
const img = (v) => {
  const x = String(v ?? '').trim();
  if (/^https?:\/\//i.test(x)) return x.slice(0, 900000);
  if (/^data:image\/(png|jpe?g|webp|avif|gif);base64,/i.test(x)) return x.slice(0, 900000);
  return '';
};

// فيديو: رابط https ينتهي بامتداد فيديو معروف
const vid = (v) => {
  const x = String(v ?? '').trim();
  return /^https:\/\/\S+\.(mp4|webm|mov|m4v)(\?\S*)?$/i.test(x) ? x.slice(0, 500) : '';
};

// عدد ضمن مدى، بقيمةٍ افتراضية عند الغياب أو الفساد
const num = (v, min, max, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

const MAX_ITEMS = 8;
const list = (raw, map) =>
  (Array.isArray(raw) ? raw : []).slice(0, MAX_ITEMS).map(map).filter((x) => x.title || x.text);

function sanitizeLanding(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const h = raw.hero && typeof raw.hero === 'object' ? raw.hero : {};
  const c = raw.cta && typeof raw.cta === 'object' ? raw.cta : {};
  return {
    hero: {
      badge: txt(h.badge, 60), badgeEn: txt(h.badgeEn, 60),
      title: txt(h.title, 120), titleEn: txt(h.titleEn, 120),
      subtitle: txt(h.subtitle, 300), subtitleEn: txt(h.subtitleEn, 300),
      image: img(h.image),
      // تعتيم الخلفية (٠–١٠٠): صورةٌ فاتحة أو فيديو مزدحم يبتلعان النصّ
      // الأبيض فوقهما. القيمة تتحكّم بحجاب خمريٍّ فوق الخلفية، والافتراضي
      // ٦٢ — يكفي لأغلب الصور ويُرفع أو يُخفَّض حسب الصورة نفسها.
      dim: num(h.dim, 0, 100, 62),
      // فيديو الهيرو: رابط مباشر لملفٍ يُشغَّل داخل الصفحة. لا نقبل روابط
      // يوتيوب/انستغرام — تلك صفحاتٌ لا ملفّات، ووضعها بـ<video> يعطي إطاراً
      // فارغاً. والصورة تبقى غلافاً يظهر ريثما يُحمّل الفيديو أو إن تعذّر.
      video: vid(h.video),
      chips: (Array.isArray(h.chips) ? h.chips : []).slice(0, 4)
        .map((x) => ({ label: txt(x?.label, 40), labelEn: txt(x?.labelEn, 40) }))
        .filter((x) => x.label || x.labelEn),
    },
    features: list(raw.features, (x) => ({
      title: txt(x?.title, 60), titleEn: txt(x?.titleEn, 60),
      desc: txt(x?.desc, 220), descEn: txt(x?.descEn, 220),
    })),
    steps: list(raw.steps, (x) => ({
      title: txt(x?.title, 60), titleEn: txt(x?.titleEn, 60),
      desc: txt(x?.desc, 220), descEn: txt(x?.descEn, 220),
    })),
    testimonials: list(raw.testimonials, (x) => ({
      text: txt(x?.text, 300), textEn: txt(x?.textEn, 300),
      name: txt(x?.name, 60), store: txt(x?.store, 60), image: img(x?.image),
      title: '', // ليمرّ من مرشّح list
    })).map(({ title, ...rest }) => rest),
    // الأسئلة الشائعة: حلّت محلّ شهاداتٍ كانت مكتوبةً للتعبئة وتُقرأ حقيقيّة.
    // list يرشّح بالحقل title، فنمرّره فارغاً ثمّ نحذفه — كما بالشهادات.
    faq: list(raw.faq, (x) => ({
      q: txt(x?.q, 120), qEn: txt(x?.qEn, 120),
      a: txt(x?.a, 400), aEn: txt(x?.aEn, 400),
      // list يُبقي ما له title أو text — فيحمل title السؤالَ ليمرّ البند، ثمّ
      // يُحذف. ولو مرّرتُه فارغاً (كما بالشهادات) لسقطت الأسئلة كلّها بصمت:
      // الشهادةُ تمرّ بحقل text، ولا text هنا.
      title: txt(x?.q, 120),
    })).map(({ title, ...rest }) => rest),
    cta: {
      title: txt(c.title, 120), titleEn: txt(c.titleEn, 120),
      subtitle: txt(c.subtitle, 300), subtitleEn: txt(c.subtitleEn, 300),
    },
    // الفوتر: «من نحن» و«تواصلوا معنا». الزائر الجادّ يبحث عن مَن خلف
    // المنصّة وكيف يصل إليها قبل أن يسلّمها متجره.
    about: {
      title: txt(raw.about?.title, 80), titleEn: txt(raw.about?.titleEn, 80),
      text: txt(raw.about?.text, 700), textEn: txt(raw.about?.textEn, 700),
    },
    contact: {
      title: txt(raw.contact?.title, 80), titleEn: txt(raw.contact?.titleEn, 80),
      email: txt(raw.contact?.email, 120),
      phone: String(raw.contact?.phone ?? '').replace(/[^\d+]/g, '').slice(0, 20),
      address: txt(raw.contact?.address, 160), addressEn: txt(raw.contact?.addressEn, 160),
      hours: txt(raw.contact?.hours, 120), hoursEn: txt(raw.contact?.hoursEn, 120),
    },
    // إخفاء أقسام بأكملها — بعض المتاجر لا تريد الشهادات مثلاً
    hidden: (Array.isArray(raw.hidden) ? raw.hidden : [])
      .map((k) => txt(k, 20)).filter((k) => ['stats', 'shelf', 'features', 'steps', 'testimonials', 'faq'].includes(k)),
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
  // كانت /^https?:///i — ثلاث شرطات: المحلّل يقرأ /^https?:/ تعبيراً نمطياً ثم
  // يعدّ ما بعده تعليقاً، فيصير image كائنَ RegExp لا نصّاً. وشرطُ الرفض
  // (!image) لا يتحقّق أبداً على كائن، فيمرّ أيّ مدخلٍ بلا فحص — بما فيه
  // javascript: — ويُخزَّن كائناً فارغاً {} بعد JSON.stringify.
  const image = /^https?:\/\//i.test(String(v.image ?? '')) ? String(v.image).slice(0, 500) : '';
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
    const landing = req.body.landing === undefined ? cur.landing : sanitizeLanding(req.body.landing);
    await query(
      `INSERT INTO site_settings (id, home_banners, announcement, announcement_en, collections, lookbook, instagram, facebook, platform_categories, landing, updated_at)
       VALUES (1, $1::jsonb, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8::jsonb, $9::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET home_banners = EXCLUDED.home_banners,
         announcement = EXCLUDED.announcement, announcement_en = EXCLUDED.announcement_en,
         collections = EXCLUDED.collections, lookbook = EXCLUDED.lookbook,
         instagram = EXCLUDED.instagram, facebook = EXCLUDED.facebook,
         platform_categories = EXCLUDED.platform_categories, landing = EXCLUDED.landing, updated_at = now()`,
      [JSON.stringify(banners), announcement, announcementEn, JSON.stringify(collections), JSON.stringify(lookbook), instagram, facebook, JSON.stringify(platformCategories), JSON.stringify(landing)]
    );
    clearPublicCache(); // إبطال كاش الذاكرة فوراً (/home و/site-info) فتظهر التعديلات حالاً
    // هذه أوسع صلاحيةٍ أثراً: تغيّر واجهة المنصّة لكلّ زائر وكلّ متجر. نسجّل
    // ما تغيّر بالضبط لا مجرّد «حُفظت الإعدادات».
    await logAdmin(req, 'site.settings', {
      type: 'settings',
      id: 'site',
      label: 'إعدادات الموقع العامّة',
      details: {
        banners: banners.length,
        collections: collections.length,
        platformCats: (platformCategories?.extra || []).length,
        hiddenCats: (platformCategories?.hidden || []).length,
        announcement: Boolean(announcement),
        landingEdited: Boolean(req.body.landing !== undefined),
      },
    });
    res.json({ banners, announcement, announcementEn, collections, lookbook, instagram, facebook, platformCategories, landing });
  } catch (err) {
    next(err);
  }
}

// معلومات المنصّة العامة (حسابات السوشيال) — للفوتر على كل الصفحات، بلا مصادقة.
export async function getSiteInfo(_req, res, next) {
  try {
    const s = await readSettings();
    // أرقام الثقة: مجاميع لا تكشف عن أيّ متجرٍ بعينه. تُحسب مع نفس النداء
    // المُخزَّن مؤقتاً (٥ دقائق) فلا تكلّف استعلاماً لكلّ زائر.
    let stats = { stores: 0, products: 0, orders: 0 };
    try {
      const active = activeStoreSql('u');
      const r = await query(
        `SELECT
           (SELECT COUNT(*)::int FROM stores s JOIN users u ON u.id = s.user_id WHERE ${active}) AS stores,
           (SELECT COUNT(*)::int FROM products p JOIN stores s ON s.id = p.store_id
              JOIN users u ON u.id = s.user_id WHERE ${active}) AS products,
           (SELECT COUNT(*)::int FROM orders o JOIN stores s ON s.id = o.store_id
              JOIN users u ON u.id = s.user_id WHERE ${active}) AS orders`
      );
      stats = { stores: r.rows[0].stores, products: r.rows[0].products, orders: r.rows[0].orders };
    } catch { /* الأرقام زينة: غيابها لا يُسقط الصفحة */ }
    res.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
    res.json({ instagram: s.instagram, facebook: s.facebook, platformCategories: s.platformCategories, landing: s.landing, stats });
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
