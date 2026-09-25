// مصنعُ الإعلانات — تُولّدُ التاجرةُ من هنا نسخَ إعلانِها وجمهورَه وميزانيتَه،
// وتحفظُه بطابورٍ جاهزٍ للنشر.
//
// لا شيءَ هنا يتّصلُ بميتا بعد: النصُّ يُنسَخُ والصورةُ تُنزَّلُ وتنشرُ التاجرةُ
// بنفسِها. وحين يصلُ إذنُ النشرِ يصيرُ الطابورُ نفسُه مصدرَ الحملاتِ بلا أن
// يتغيّرَ شيءٌ ممّا تراه.

import { query } from '../config/db.js';
import { writeAd, GOAL_KEYS, suggestBudget, suggestAudience } from '../utils/adWriter.js';
import {
  adsConfigured, listAdAccounts, getAdAccount, publishCampaign, setCampaignStatus,
  getAdInsights, ADS_DEV_ACCOUNT,
} from '../utils/metaAds.js';

// وسيطةُ القطعةِ الممثِّلة. كلُّ منتجاتِ المنصّةِ اليومَ فيديو بلا صورةٍ واحدة،
// فقراءةُ images[0] وحدَها تُعيدُ فراغاً لكلِّ قطعةٍ — إعلانٌ بلا صورةٍ ومصغّرةٌ
// فارغة. نُعيدُ الرابطَ كما هو (صورةً كان أو فيديو) لأنّ أدواتِ كلاوديناري عندنا
// (cldThumb وheroCrop) تعرفُ الفيديو وتأخذُ منه لقطةَ الثانيةِ صفر.
function productMedia(p) {
  const imgs = Array.isArray(p?.images) ? p.images.filter(Boolean) : [];
  return imgs[0] || p?.video_url || '';
}

const STATUSES = ['draft', 'ready', 'published'];
const MAX_CAMPAIGNS = 60; // طابورٌ لا مستودع

async function getUserStore(userId) {
  // اللهجةُ اختارَتها التاجرةُ مرّةً بتبويبِ البائعة، فلا تُسألُ عنها ثانيةً هنا:
  // صوتُ المتجرِ واحدٌ بالمحادثةِ والإعلان.
  const cols = 'id, name, slug, logo_url, theme_color, bot_dialect, ads_account_id, ads_currency, ig_page_id, ig_user_id';
  const r = await query(`SELECT ${cols} FROM stores WHERE user_id = $1`, [userId])
    .catch((e) => (e.code === '42703'
      ? query("SELECT id, name, slug, logo_url, theme_color, 'ps' AS bot_dialect, '' AS ads_account_id, '' AS ads_currency, ig_page_id, ig_user_id FROM stores WHERE user_id = $1", [userId])
      : Promise.reject(e)));
  return r.rows[0] || null;
}

function mapCampaign(c) {
  return {
    id: c.id,
    productId: c.product_id,
    productName: c.product_name || '',
    productImage: productMedia({ images: c.product_images, video_url: c.product_video }),
    name: c.name,
    goal: c.goal,
    status: c.status,
    copies: Array.isArray(c.copies) ? c.copies : [],
    chosen: Number(c.chosen) || 0,
    audience: c.audience && typeof c.audience === 'object' ? c.audience : {},
    budget: Number(c.budget) || 0,
    days: Number(c.days) || 5,
    creative: c.creative && typeof c.creative === 'object' ? c.creative : {},
    createdAt: c.created_at,
    publishedAt: c.published_at,
    metaCampaignId: c.meta_campaign_id || '',
    metaAdId: c.meta_ad_id || '',
    metaStatus: c.meta_status || '',
    managerUrl: c.meta_campaign_id
      ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${String(c.meta_account_id || '').replace('act_', '')}&selected_campaign_ids=${c.meta_campaign_id}`
      : '',
  };
}

// GET /api/ads — الطابور + قطعُ المتجرِ للاختيارِ منها
export async function listAds(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const r = await query(
      `SELECT c.*, p.name AS product_name, p.images AS product_images, p.video_url AS product_video
       FROM ad_campaigns c LEFT JOIN products p ON p.id = c.product_id
       WHERE c.store_id = $1 ORDER BY c.created_at DESC LIMIT ${MAX_CAMPAIGNS}`,
      [store.id]
    ).catch((e) => {
      // الجدولُ لم يصل هذا الخادمَ بعد: طابورٌ فارغٌ أهونُ من شاشةٍ ساقطة
      if (e.code === '42P01') return { rows: [] };
      throw e;
    });

    const prod = await query(
      `SELECT id, name, price, old_price, sale_ends_at, category, color, images, video_url
       FROM products WHERE store_id = $1 AND hidden_at IS NULL
       ORDER BY featured DESC, created_at DESC LIMIT 200`,
      [store.id]
    );

    res.json({
      campaigns: r.rows.map(mapCampaign),
      products: prod.rows.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        oldPrice: p.old_price != null ? Number(p.old_price) : null,
        saleEndsAt: p.sale_ends_at,
        category: p.category,
        image: productMedia(p),
      })),
      store: { name: store.name, slug: store.slug, logo: store.logo_url || '', color: store.theme_color || '' },
      smart: Boolean(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY),
      // النشرُ المباشرُ إلى ميتا: نقولُ للواجهةِ إن كان مفتوحاً وبأيِّ حسابٍ وعملة،
      // فلا يظهرُ زرٌّ لا يعملُ ولا تُعرَضُ ميزانيّةٌ بعملةٍ غيرِ عملةِ الحساب.
      publishing: {
        enabled: adsConfigured(),
        accountId: store.ads_account_id || ADS_DEV_ACCOUNT || '',
        currency: store.ads_currency || '',
        pageLinked: Boolean(store.ig_page_id),
      },
    });
  } catch (err) { next(err); }
}

// POST /api/ads/generate — { productId, goal, tone } · يولّدُ بلا أن يحفظ
export async function generateAd(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const id = String(req.body.productId || '');
    const p = await query(
      `SELECT id, name, description, category, department, price, old_price, sale_ends_at,
              size, color, stock, size_stock, color_stock, images
       FROM products WHERE id = $1 AND store_id = $2 AND hidden_at IS NULL`,
      [id, store.id]
    );
    const product = p.rows[0];
    if (!product) return res.status(404).json({ error: 'اختاري قطعة من متجرك أولاً.' });

    const out = await writeAd({
      product,
      store,
      goal: GOAL_KEYS.includes(req.body.goal) ? req.body.goal : 'sales',
      tone: ['warm', 'luxury', 'playful'].includes(req.body.tone) ? req.body.tone : 'warm',
      dialect: store.bot_dialect || 'ps',
    });
    res.json(out);
  } catch (err) { next(err); }
}

function readBody(b, store) {
  const copies = (Array.isArray(b.copies) ? b.copies : []).slice(0, 3).map((c) => ({
    headline: String(c?.headline || '').slice(0, 120),
    primary: String(c?.primary || '').slice(0, 800),
    cta: String(c?.cta || '').slice(0, 40),
    hashtags: (Array.isArray(c?.hashtags) ? c.hashtags : []).map((h) => String(h).slice(0, 40)).slice(0, 8),
  }));
  const a = b.audience && typeof b.audience === 'object' ? b.audience : {};
  return {
    name: String(b.name || '').trim().slice(0, 160) || `حملة ${store.name}`,
    goal: GOAL_KEYS.includes(b.goal) ? b.goal : 'sales',
    status: STATUSES.includes(b.status) ? b.status : 'draft',
    copies,
    chosen: Math.max(0, Math.min(2, Number(b.chosen) || 0)),
    audience: {
      ageMin: Math.max(13, Math.min(65, Number(a.ageMin) || 18)),
      ageMax: Math.max(13, Math.min(65, Number(a.ageMax) || 45)),
      genders: ['female', 'male', 'all'].includes(a.genders) ? a.genders : 'female',
      locations: (Array.isArray(a.locations) ? a.locations : []).map((x) => String(x).slice(0, 60)).slice(0, 12),
      interests: (Array.isArray(a.interests) ? a.interests : []).map((x) => String(x).slice(0, 60)).slice(0, 12),
    },
    // الميزانيّةُ رقمٌ تكتبُه التاجرة، فله سقفٌ هنا: خطأٌ بصفرٍ زائدٍ يُكتَبُ مرّةً
    // ويُقرأُ عشرَ مرّاتٍ بعدَ فواتِ الأوان.
    budget: Math.max(0, Math.min(5000, Number(b.budget) || 0)),
    days: Math.max(1, Math.min(60, Number(b.days) || 5)),
    creative: b.creative && typeof b.creative === 'object' ? b.creative : {},
  };
}

// POST /api/ads — حفظُ حملةٍ بالطابور
export async function createAd(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const count = await query('SELECT count(*)::int AS n FROM ad_campaigns WHERE store_id = $1', [store.id]);
    if ((count.rows[0]?.n || 0) >= MAX_CAMPAIGNS) {
      return res.status(400).json({ error: 'الطابور ممتلئ. احذفي حملة قديمة أولاً.' });
    }

    const v = readBody(req.body, store);
    let productId = null;
    if (req.body.productId) {
      const p = await query('SELECT id FROM products WHERE id = $1 AND store_id = $2', [req.body.productId, store.id]);
      productId = p.rows[0]?.id || null;
    }
    const r = await query(
      `INSERT INTO ad_campaigns (store_id, product_id, name, goal, status, copies, chosen, audience, budget, days, creative)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [store.id, productId, v.name, v.goal, v.status, JSON.stringify(v.copies), v.chosen,
        JSON.stringify(v.audience), v.budget, v.days, JSON.stringify(v.creative)]
    );
    res.status(201).json({ id: r.rows[0].id });
  } catch (err) { next(err); }
}

// PUT /api/ads/:id
export async function updateAd(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const own = await query('SELECT id FROM ad_campaigns WHERE id = $1 AND store_id = $2', [req.params.id, store.id]);
    if (!own.rows[0]) return res.status(404).json({ error: 'الحملة غير موجودة.' });

    const v = readBody(req.body, store);
    await query(
      `UPDATE ad_campaigns SET name=$2, goal=$3, status=$4, copies=$5, chosen=$6,
         audience=$7, budget=$8, days=$9, creative=$10,
         published_at = CASE WHEN $4 = 'published' AND published_at IS NULL THEN now()
                             WHEN $4 <> 'published' THEN NULL ELSE published_at END
       WHERE id = $1`,
      [req.params.id, v.name, v.goal, v.status, JSON.stringify(v.copies), v.chosen,
        JSON.stringify(v.audience), v.budget, v.days, JSON.stringify(v.creative)]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// DELETE /api/ads/:id
export async function deleteAd(req, res, next) {
  try {
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    await query('DELETE FROM ad_campaigns WHERE id = $1 AND store_id = $2', [req.params.id, store.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ───────────────────── التوصيلُ بميتا ─────────────────────

// GET /api/ads/accounts — الحساباتُ الإعلانيّةُ المتاحةُ للربط
export async function listAccounts(req, res) {
  try {
    if (!adsConfigured()) return res.status(503).json({ error: 'النشر المباشر غير مفعّل على الخادم بعد.' });
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    res.json({ accounts: await listAdAccounts() });
  } catch (err) {
    res.status(400).json({ error: err.message || 'تعذّر قراءة الحسابات الإعلانية.' });
  }
}

// PUT /api/ads/account — { accountId } · ربطُ الحسابِ الإعلانيِّ بالمتجر
export async function connectAccount(req, res) {
  try {
    if (!adsConfigured()) return res.status(503).json({ error: 'النشر المباشر غير مفعّل على الخادم بعد.' });
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const id = String(req.body.accountId || '').replace('act_', '').trim();
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'رقم الحساب الإعلاني غير صالح.' });

    // العملةُ تُقرأُ من ميتا لا تُفترَض: حسابٌ بالدولارِ وميزانيّةٌ تُكتَبُ بالشيكلِ
    // تعني أن يُصرَفَ ثلاثةُ أضعافِها ونصفٌ بلا أن تنتبهَ التاجرة.
    const acc = await getAdAccount(id);
    if (Number(acc.account_status) !== 1) {
      return res.status(400).json({ error: 'هذا الحساب الإعلاني غير نشط عند ميتا (موقوف أو بانتظار مراجعة).' });
    }
    await query('UPDATE stores SET ads_account_id = $2, ads_currency = $3 WHERE id = $1',
      [store.id, id, acc.currency || '']);
    res.json({ accountId: id, currency: acc.currency, name: acc.name });
  } catch (err) {
    res.status(400).json({ error: err.message || 'تعذّر ربط الحساب الإعلاني.' });
  }
}

// POST /api/ads/:id/publish — { imageBase64 }
//
// تُنشَأُ الحملةُ عندَ ميتا **موقوفة** دائماً. لا معاملَ يغيّرُ ذلك ولا مسارَ آخر:
// التشغيلُ نداءٌ منفصلٌ لا يجري إلّا بضغطةِ التاجرةِ بعدَ أن ترى حملتَها.
export async function publishAd(req, res) {
  try {
    if (!adsConfigured()) return res.status(503).json({ error: 'النشر المباشر غير مفعّل على الخادم بعد.' });
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });

    const r = await query('SELECT * FROM ad_campaigns WHERE id = $1 AND store_id = $2', [req.params.id, store.id]);
    const c = r.rows[0];
    if (!c) return res.status(404).json({ error: 'الحملة غير موجودة.' });
    if (c.meta_campaign_id) return res.status(400).json({ error: 'هذه الحملة منشورة عند ميتا أصلاً.' });

    const accountId = store.ads_account_id || ADS_DEV_ACCOUNT;
    if (!accountId) return res.status(400).json({ error: 'اربطي حسابك الإعلاني أولاً.' });

    const copies = Array.isArray(c.copies) ? c.copies : [];
    const copy = copies[Number(c.chosen) || 0] || copies[0];
    if (!copy) return res.status(400).json({ error: 'لا يوجد نصّ للحملة.' });

    const site = (process.env.PUBLIC_SITE_URL || 'https://bazarastore.site').replace(/\/$/, '');
    const link = c.product_id
      ? `${site}/store/${store.slug}/product/${c.product_id}`
      : `${site}/store/${store.slug}`;

    const out = await publishCampaign({
      accountId,
      currency: store.ads_currency || 'ILS',
      pageId: store.ig_page_id || process.env.ADS_DEV_PAGE || '',
      igId: store.ig_user_id || process.env.ADS_DEV_IG || '',
      imageBase64: String(req.body.imageBase64 || ''),
      name: c.name,
      goal: c.goal,
      copy,
      link,
      audience: c.audience && typeof c.audience === 'object' ? c.audience : {},
      budget: Number(c.budget) || 0,
      days: Number(c.days) || 5,
    });

    await query(
      `UPDATE ad_campaigns SET meta_account_id = $2, meta_campaign_id = $3, meta_adset_id = $4,
         meta_ad_id = $5, meta_status = 'PAUSED', status = 'published', published_at = now()
       WHERE id = $1`,
      [c.id, String(accountId), out.campaignId, out.adsetId, out.adId]
    );
    res.json(out);
  } catch (err) {
    console.error('⚠️ نشر الإعلان:', err.message, err.body ? JSON.stringify(err.body).slice(0, 400) : '');
    res.status(400).json({ error: err.message || 'تعذّر نشر الحملة عند ميتا.' });
  }
}

// POST /api/ads/:id/status — { active } · تشغيلٌ أو إيقاف
export async function toggleAd(req, res) {
  try {
    if (!adsConfigured()) return res.status(503).json({ error: 'النشر المباشر غير مفعّل على الخادم بعد.' });
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('SELECT id, meta_campaign_id FROM ad_campaigns WHERE id = $1 AND store_id = $2',
      [req.params.id, store.id]);
    const c = r.rows[0];
    if (!c || !c.meta_campaign_id) return res.status(400).json({ error: 'الحملة غير منشورة عند ميتا.' });
    const status = await setCampaignStatus(c.meta_campaign_id, req.body.active === true ? 'ACTIVE' : 'PAUSED');
    await query('UPDATE ad_campaigns SET meta_status = $2 WHERE id = $1', [c.id, status]);
    res.json({ status });
  } catch (err) {
    res.status(400).json({ error: err.message || 'تعذّر تغيير حالة الحملة.' });
  }
}

// GET /api/ads/:id/insights
export async function adInsights(req, res) {
  try {
    if (!adsConfigured()) return res.status(503).json({ error: 'النشر المباشر غير مفعّل على الخادم بعد.' });
    const store = await getUserStore(req.user.id);
    if (!store) return res.status(404).json({ error: 'لا يوجد متجر.' });
    const r = await query('SELECT meta_ad_id FROM ad_campaigns WHERE id = $1 AND store_id = $2',
      [req.params.id, store.id]);
    const adId = r.rows[0] && r.rows[0].meta_ad_id;
    if (!adId) return res.status(400).json({ error: 'الحملة غير منشورة عند ميتا.' });
    res.json(await getAdInsights(adId));
  } catch (err) {
    res.status(400).json({ error: err.message || 'تعذّر قراءة النتائج.' });
  }
}

export { suggestBudget, suggestAudience };
