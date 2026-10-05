// توصيلُ الطابورِ بميتا — إنشاءُ حملةٍ مموّلةٍ في الحسابِ الإعلانيِّ للتاجرة.
//
// **كلُّ ما يُنشَأُ هنا يُنشَأُ موقوفاً (PAUSED).** لا استثناء. المالُ يُصرَفُ بضغطةٍ
// من صاحبةِ الحسابِ بعدَ أن ترى الحملةَ بعينِها، لا بنداءٍ من خادمِنا. وهذا ليس
// تحفّظاً زائداً: حملةٌ تبدأُ وحدَها بميزانيّةٍ خاطئةٍ تصرفُ مالَ تاجرةٍ بليلةٍ
// واحدةٍ ولا تُستردّ.
//
// ولا نلمسُ وسيلةَ الدفعِ ولا ننشئُ في حسابٍ لم تربطْه بنفسِها.
//
// **مصدرُ التوكن مرحلتان:** اليومَ `ADS_DEV_TOKEN` (توكنُ مطوّرٍ لحسابٍ يديرُه
// مسؤولُ التطبيق — مستوى التطوير عند ميتا يسمحُ به بلا مراجعة)، وبعدَ المراجعةِ
// الثانيةِ توكنُ كلِّ تاجرةٍ من تدفّقِ الربط. ما بينهما لا يتغيّرُ سطرٌ هنا.

import { GRAPH } from '../config/instagram.js';
import { PLACEMENTS, cityByAr } from './adCities.js';

export const ADS_DEV_TOKEN = process.env.ADS_DEV_TOKEN || '';
export const ADS_DEV_ACCOUNT = process.env.ADS_DEV_ACCOUNT || ''; // act_… أو الرقم وحدَه

export function adsConfigured() {
  return Boolean(ADS_DEV_TOKEN);
}

const actId = (id) => (String(id).startsWith('act_') ? String(id) : `act_${id}`);

async function graph(path, { method = 'GET', token, params, body } = {}) {
  const url = new URL(`${GRAPH}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const opts = { method, headers: { Accept: 'application/json' } };
  if (body) {
    // الواجهةُ الإعلانيّةُ تقبلُ الحقولَ المركّبةَ كسلاسلِ JSON داخلَ نموذجٍ عاديّ،
    // لا ككائنٍ واحدٍ بجسمِ JSON — وهذا أكثرُ ما يُربكُ أوّلَ تكاملٍ معها.
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || v === null) continue;
      form.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    form.set('access_token', token);
    opts.body = form;
  } else if (token) {
    url.searchParams.set('access_token', token);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error || {};
    const e = new Error(err.error_user_msg || err.message || `Graph ${res.status}`);
    e.status = res.status;
    e.body = data;
    e.metaCode = err.code;
    throw e;
  }
  return data;
}

// ───────────────────── الحساباتُ الإعلانيّة ─────────────────────

// العملةُ هي أخطرُ حقلٍ هنا: الحسابُ بالدولارِ ولوحتُنا تعرضُ الشيكل، فرقمٌ يُكتَبُ
// ٤٥ ويُرسَلُ كما هو يصيرُ خمسةً وأربعينَ دولاراً. نقرأُ العملةَ ونعرضُها للتاجرة.
export async function listAdAccounts(token = ADS_DEV_TOKEN) {
  const r = await graph('/me/adaccounts', {
    token,
    params: { fields: 'id,account_id,name,account_status,currency,timezone_name,disable_reason', limit: '50' },
  });
  return (r.data || []).map((a) => ({
    id: a.id,
    accountId: a.account_id,
    name: a.name,
    // 1 = نشط. ما عداه موقوفٌ أو مغلقٌ أو بانتظارِ مراجعة — ولا يقبلُ إنشاءَ حملة.
    active: Number(a.account_status) === 1,
    status: Number(a.account_status),
    currency: a.currency,
    timezone: a.timezone_name,
  }));
}

export async function getAdAccount(accountId, token = ADS_DEV_TOKEN) {
  return graph(`/${actId(accountId)}`, {
    token,
    params: { fields: 'account_id,name,account_status,currency,timezone_name,min_daily_budget' },
  });
}

// ───────────────────── الصورة ─────────────────────

// صورةُ الإعلانِ تُرفَعُ إلى ميتا مباشرةً بالبايتات، لا إلى مستضيفِ صورِنا ثمّ برابط.
// وهذا يوفّرُ رصيدَ الوسائطِ المحدودَ كلَّه: مسوّدةٌ لا تُنشَرُ لا تكلّفُ شيئاً، والمنشورةُ
// تعيشُ عندَ ميتا لا عندنا.
export async function uploadAdImage(accountId, base64, token = ADS_DEV_TOKEN) {
  const clean = String(base64 || '').replace(/^data:image\/\w+;base64,/, '');
  if (!clean) throw new Error('صورة الإعلان مفقودة.');
  const r = await graph(`/${actId(accountId)}/adimages`, {
    method: 'POST', token, body: { bytes: clean },
  });
  // الردُّ يأتي مفهرساً باسمِ ملفٍ يولّدُه ميتا، فنأخذُ أوّلَ قيمةٍ فيه
  const first = r.images ? Object.values(r.images)[0] : null;
  if (!first?.hash) throw new Error('تعذّر رفع صورة الإعلان إلى ميتا.');
  return first.hash;
}

// ───────────────────── الحملةُ والمجموعةُ والإعلان ─────────────────────

// أهدافُنا الأربعةُ بأسماءِ ميتا الحاليّة (OUTCOME_*).
// «مبيعات» بلا بكسلٍ تُعيَّنُ إلى الزياراتِ عمداً: التحسينُ على الشراءِ يتطلّبُ بكسلاً
// على الموقعِ وحدثَ شراءٍ مُعرَّفاً، وبلا ذلك تتعلّمُ الحملةُ على لا شيءٍ وتصرفُ بلا
// نتيجة. ومع بكسلِ المتجرِ (إعداداتُ المتجر ← البكسلات) تصيرُ مبيعاتٍ حقيقيّة.
export function objectiveFor(goal, { pixelId = '' } = {}) {
  if (goal === 'sales' && pixelId) return 'OUTCOME_SALES';
  return {
    sales: 'OUTCOME_TRAFFIC',
    traffic: 'OUTCOME_TRAFFIC',
    messages: 'OUTCOME_ENGAGEMENT',
    awareness: 'OUTCOME_AWARENESS',
  }[goal] || 'OUTCOME_TRAFFIC';
}

export async function createCampaign(accountId, { name, goal, pixelId }, token = ADS_DEV_TOKEN) {
  const objective = objectiveFor(goal, { pixelId });
  const r = await graph(`/${actId(accountId)}/campaigns`, {
    method: 'POST',
    token,
    body: {
      name: name.slice(0, 120),
      objective,
      status: 'PAUSED',
      special_ad_categories: [], // ليست إسكاناً ولا توظيفاً ولا ائتماناً ولا سياسة
      // ميتا ترفضُ الحملةَ ما لم يُحسَم هذا صراحةً حين تكونُ الميزانيّةُ على المجموعةِ
      // لا على الحملة. true تعني أن تتقاسمَ المجموعاتُ خُمسَ ميزانيّاتِها فيما بينها،
      // ونقولُ false: التاجرةُ حدّدت ميزانيّةَ هذه القطعةِ بعينِها فلا تُنقَلُ لغيرِها.
      is_adset_budget_sharing_enabled: 'false',
    },
  });
  return { id: r.id, objective };
}

// الجنسُ عندَ ميتا: 1 ذكور · 2 إناث · فراغٌ يعني الجميع
const GENDERS = { female: [2], male: [1], all: undefined };

// ما يُحسِّنُ عليه كلُّ هدف، وما يُضافُ للمجموعةِ ليفهمَ ميتا أين تذهبُ النتيجة.
//
// «رسائل» كانت تُحسِّنُ على التفاعلِ بالمنشور (إعجابٌ وتعليق) — أي تدفعُ التاجرةُ
// ثمنَ قلوبٍ لا ثمنَ محادثات. صارت محادثاتٍ فعليّة: الإعلانُ يفتحُ دايركت إنستغرام
// (أو ماسنجر الصفحة إن لم يُربَط إنستغرام)، وهناك تستلمُها البائعةُ الآليّة.
function optimizationFor(objective, { pixelId, igId, pageId }) {
  if (objective === 'OUTCOME_SALES') {
    return {
      optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: { pixel_id: pixelId, custom_event_type: 'PURCHASE' },
    };
  }
  if (objective === 'OUTCOME_ENGAGEMENT') {
    return {
      optimization_goal: 'CONVERSATIONS',
      destination_type: igId ? 'INSTAGRAM_DIRECT' : 'MESSENGER',
      promoted_object: { page_id: pageId },
    };
  }
  if (objective === 'OUTCOME_AWARENESS') return { optimization_goal: 'REACH' };
  return { optimization_goal: 'LINK_CLICKS', destination_type: 'WEBSITE' };
}

// أماكنُ الظهور: فراغٌ = تلقائيّ (ميتا توزّعُ حيث النتيجةُ أرخص — الأنسبُ لأغلبِ
// الحملات). وإلّا نبني المنصّاتِ ومواضعَها من مفاتيحِ اللوحة.
function placementTargeting(keys = []) {
  const picked = keys.filter((k) => PLACEMENTS[k]);
  if (!picked.length) return {};
  const out = { publisher_platforms: [] };
  for (const k of picked) {
    const p = PLACEMENTS[k];
    if (!out.publisher_platforms.includes(p.platform)) out.publisher_platforms.push(p.platform);
    out[p.key] = [...(out[p.key] || []), p.pos];
  }
  return out;
}

export function buildTargeting({ audience = {}, cityKeys = [], placements = [], interestIds = [] }) {
  const targeting = {
    // مدنٌ بعينِها إن اختارتها التاجرة، وإلّا فلسطينُ كلُّها. لا نجمعُهما: ميتا ترفضُ
    // استهدافاً تتداخلُ مواقعُه (مدينةٌ داخلَ بلدٍ مستهدَفٍ أصلاً).
    geo_locations: cityKeys.length
      ? { cities: cityKeys.map((key) => ({ key })) }
      : { countries: ['PS'] },
    // «الجمهور المتقدّم» يوسّعُ الاستهدافَ خارجَ ما اختارَتْه التاجرةُ حين يرى ميتا
    // فرصةً أفضل. نطفئُه: وعدُ التبويبِ أنّ الإعلانَ يذهبُ لمن حدّدَتْهُنّ هي —
    // وميزانيّةٌ صغيرةٌ تتبدّدُ على جمهورٍ لم تختَرْه أسوأُ من ميزانيّةٍ ضيّقة.
    targeting_automation: { advantage_audience: 0 },
    age_min: Math.max(18, Math.min(65, Number(audience?.ageMin) || 18)),
    age_max: Math.max(18, Math.min(65, Number(audience?.ageMax) || 45)),
    ...placementTargeting(placements),
  };
  const g = GENDERS[audience?.genders];
  if (g) targeting.genders = g;
  if (interestIds.length) targeting.flexible_spec = [{ interests: interestIds.map((id) => ({ id })) }];
  return targeting;
}

export async function createAdSet(accountId, opts, token = ADS_DEV_TOKEN) {
  const { name, campaignId, objective, dailyBudgetMinor, days, startAt, targeting, pageId, igId, pixelId } = opts;
  // البدءُ بموعدٍ تختارُه التاجرة، وإلّا بعدَ عشرِ دقائق. موعدٌ فاتَ يُعامَلُ كالآن.
  const soon = Date.now() + 10 * 60 * 1000;
  const start = new Date(Math.max(soon, startAt ? new Date(startAt).getTime() || 0 : 0));
  const end = new Date(start.getTime() + Math.max(1, days) * 24 * 3600 * 1000);

  const body = {
    name: name.slice(0, 120),
    campaign_id: campaignId,
    status: 'PAUSED',
    // الميزانيّةُ بالوحدةِ الصغرى لعملةِ الحساب (سنتاً أو أغورة) — لا بالوحدةِ الكبرى
    daily_budget: String(Math.round(dailyBudgetMinor)),
    billing_event: 'IMPRESSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    targeting,
    ...optimizationFor(objective, { pixelId, igId, pageId }),
  };

  const r = await graph(`/${actId(accountId)}/adsets`, { method: 'POST', token, body });
  return { id: r.id, startTime: start, endTime: end };
}

// ───────────────────── الفيديو ─────────────────────

// كلُّ قطعِ المنصّةِ اليومَ فيديو — والفيديو يبيعُ الملابسَ أكثرَ من أيِّ صورة.
// ميتا تجلبُ الملفَّ بنفسِها من رابطِه العامّ (محرّكُنا)، ثمّ تعالجُه دقيقةً أو اثنتين؛
// والتصميمُ لا يُنشَأُ على فيديو لم يجهز، فننتظرُه.
export async function uploadAdVideo(accountId, fileUrl, token = ADS_DEV_TOKEN) {
  if (!/^https:\/\//.test(String(fileUrl || ''))) throw new Error('رابط الفيديو غير صالح.');
  const r = await graph(`/${actId(accountId)}/advideos`, {
    method: 'POST', token, body: { file_url: fileUrl, name: 'bazara-ad' },
  });
  if (!r.id) throw new Error('تعذّر رفع الفيديو إلى ميتا.');
  for (let i = 0; i < 40; i += 1) {
    const v = await graph(`/${r.id}`, { token, params: { fields: 'status' } });
    const st = v.status?.video_status;
    if (st === 'ready') return r.id;
    if (st === 'error') throw new Error('ميتا ما قبلت الفيديو (صيغة أو حجم).');
    await new Promise((ok) => setTimeout(ok, 3000));
  }
  throw new Error('الفيديو لسّا عمّ يتجهّز عند ميتا. جرّبي النشر بعد دقيقتين.');
}

// ───────────────────── التصميم ─────────────────────

// زرُّ الإعلان: للرسائلِ يفتحُ المحادثة، ولغيرِها يفتحُ صفحةَ القطعة.
function ctaFor(objective, { igId, link }) {
  if (objective === 'OUTCOME_ENGAGEMENT') {
    return igId
      ? { type: 'INSTAGRAM_MESSAGE', value: { app_destination: 'INSTAGRAM_DIRECT' } }
      : { type: 'MESSAGE_PAGE', value: { app_destination: 'MESSENGER' } };
  }
  if (objective === 'OUTCOME_AWARENESS') return { type: 'LEARN_MORE', value: { link } };
  return { type: 'SHOP_NOW', value: { link } };
}

export async function createCreative(accountId, opts, token = ADS_DEV_TOKEN) {
  const { name, pageId, igId, imageHash, videoId, message, headline, description, link, objective } = opts;
  const cta = ctaFor(objective, { igId, link });

  // فيديو: الصورةُ المرسومةُ تصيرُ غلافَه (ميتا تشترطُ غلافاً لكلِّ إعلانِ فيديو)
  const spec = videoId
    ? {
      page_id: pageId,
      video_data: {
        video_id: videoId,
        image_hash: imageHash,
        message,
        title: headline,
        ...(description ? { link_description: description } : {}),
        call_to_action: cta,
      },
    }
    : {
      page_id: pageId,
      link_data: {
        image_hash: imageHash,
        link,
        message,
        name: headline,
        ...(description ? { description } : {}),
        call_to_action: cta,
      },
    };

  const body = { name: name.slice(0, 120), object_story_spec: spec };
  // كان هنا `degrees_of_freedom_spec.creative_features_spec.standard_enhancements`
  // بـOPT_OUT — أي «لا تُعدّلي يا ميتا صورةَ التاجرةِ ولا نصَّها». وميتا ألغت الحقلَ
  // وصارت ترفضُ التصميمَ كلَّه بسببِه:
  //   «Including standard enhancements field in creative has been deprecated.
  //    Please choose to set individual features instead.»
  // فحُذِف. والبديلُ المذكورُ (إطفاءُ كلِّ ميزةٍ باسمِها) أسماؤُه تتغيّرُ عندَ ميتا
  // واسمٌ واحدٌ مجهولٌ يُسقِطُ النداءَ كلَّه — فلا يُبنى على التخمين. والإطفاءُ متاحٌ
  // للتاجرةِ من إعداداتِ حسابِها بـAds Manager، وهذا أضمنُ من حقلٍ يُلغى فجأة.
  // بلا هذا المعرّفِ لا يظهرُ الإعلانُ على إنستغرام بحسابِ التاجرةِ بل باسمِ الصفحة
  if (igId) body.object_story_spec.instagram_actor_id = igId;

  const r = await graph(`/${actId(accountId)}/adcreatives`, { method: 'POST', token, body });
  return { id: r.id };
}

export async function createAd(accountId, { name, adsetId, creativeId }, token = ADS_DEV_TOKEN) {
  const r = await graph(`/${actId(accountId)}/ads`, {
    method: 'POST',
    token,
    body: {
      name: name.slice(0, 120),
      adset_id: adsetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',
    },
  });
  return { id: r.id };
}

// ───────────────────── الاهتماماتُ والمدن ─────────────────────

// كلماتُ الاهتمامِ التي تكتبُها التاجرةُ نصٌّ حرّ، وميتا لا تفهمُ إلّا معرّفات.
// ما لا يُطابَقُ يُترَكُ — استهدافٌ أوسعُ أهونُ من استهدافٍ خاطئ.
export async function resolveInterests(words = [], token = ADS_DEV_TOKEN) {
  const ids = [];
  for (const w of words.slice(0, 5)) {
    try {
      const r = await graph('/search', { token, params: { type: 'adinterest', q: w, limit: '1', locale: 'ar_AR' } });
      const hit = r.data?.[0];
      if (hit?.id) ids.push(hit.id);
    } catch { /* كلمةٌ لم تُطابَق: نتجاوزُها */ }
  }
  return ids;
}

// اقتراحاتُ الاهتمامِ وهي تكتب — بحجمِ جمهورِ كلٍّ منها، كما يعرضُها Ads Manager.
export async function searchInterests(q, token = ADS_DEV_TOKEN) {
  const r = await graph('/search', { token, params: { type: 'adinterest', q, limit: '8', locale: 'ar_AR' } });
  return (r.data || []).map((x) => ({
    id: x.id,
    name: x.name,
    size: Number(x.audience_size_upper_bound || x.audience_size || 0) || null,
  }));
}

// اسمُ المدينةِ العربيُّ → مفتاحُ ميتا. ما لا يُطابَقُ يُترَك، وإن لم يُطابَقْ شيءٌ
// عادَ الاستهدافُ لفلسطينَ كلِّها بدل إعلانٍ لا يذهبُ لأحد.
export async function resolveCities(names = [], token = ADS_DEV_TOKEN) {
  const keys = [];
  for (const ar of names.slice(0, 15)) {
    const city = cityByAr(ar);
    if (!city) continue;
    try {
      const r = await graph('/search', {
        token,
        params: { type: 'adgeolocation', q: city.en, location_types: '["city"]', limit: '5' },
      });
      const hit = (r.data || []).find((x) => ['PS', 'IL'].includes(x.country_code)) || null;
      if (hit?.key && !keys.includes(hit.key)) keys.push(hit.key);
    } catch { /* مدينةٌ لم تُطابَق */ }
  }
  return keys;
}

// حجمُ الجمهورِ المتوقَّع قبلَ النشر — الرقمُ الذي يُطمئنُ أو يُنذرُ بأنّ الاستهدافَ ضيّق.
export async function estimateAudience(accountId, { targeting, objective, pixelId, igId, pageId }, token = ADS_DEV_TOKEN) {
  const opt = optimizationFor(objective, { pixelId, igId, pageId });
  const r = await graph(`/${actId(accountId)}/delivery_estimate`, {
    token,
    params: {
      targeting_spec: JSON.stringify(targeting),
      optimization_goal: opt.optimization_goal,
      ...(opt.promoted_object ? { promoted_object: JSON.stringify(opt.promoted_object) } : {}),
    },
  });
  const d = r.data?.[0] || {};
  return {
    lower: Number(d.estimate_mau_lower_bound) || null,
    upper: Number(d.estimate_mau_upper_bound) || null,
    daily: Array.isArray(d.daily_outcomes_curve) && d.daily_outcomes_curve.length
      ? d.daily_outcomes_curve : null,
  };
}

// ───────────────────── النتائج ─────────────────────

// الأفعالُ التي تهمُّ متجراً: كبسةٌ على الرابط، محادثةٌ بدأت، وشراءٌ تمّ.
function actionsOf(row) {
  const pick = (types) => (row.actions || [])
    .filter((a) => types.includes(a.action_type))
    .reduce((n, a) => n + (Number(a.value) || 0), 0);
  return {
    linkClicks: pick(['link_click']),
    messages: pick(['onsite_conversion.messaging_conversation_started_7d']),
    purchases: pick(['offsite_conversion.fb_pixel_purchase', 'purchase']),
  };
}

function metricsOf(d = {}) {
  return {
    impressions: Number(d.impressions) || 0,
    reach: Number(d.reach) || 0,
    clicks: Number(d.clicks) || 0,
    spend: Number(d.spend) || 0,
    cpc: Number(d.cpc) || 0,
    ctr: Number(d.ctr) || 0,
    ...actionsOf(d),
  };
}

export async function getAdInsights(adId, token = ADS_DEV_TOKEN) {
  const r = await graph(`/${adId}/insights`, {
    token,
    params: { fields: 'impressions,reach,clicks,spend,cpc,ctr,actions', date_preset: 'maximum' },
  });
  return metricsOf(r.data?.[0]);
}

// نتائجُ الحملةِ بمدّةٍ تختارُها التاجرة: المجموعُ، ومعه يومٌ بيوم للرسم.
const PRESETS = ['today', 'yesterday', 'last_7d', 'last_14d', 'last_30d', 'maximum'];
export async function getCampaignInsights(campaignId, preset = 'last_7d', token = ADS_DEV_TOKEN) {
  const date_preset = PRESETS.includes(preset) ? preset : 'last_7d';
  const fields = 'impressions,reach,clicks,spend,cpc,ctr,actions';
  const [total, daily] = await Promise.all([
    graph(`/${campaignId}/insights`, { token, params: { fields, date_preset } }),
    graph(`/${campaignId}/insights`, { token, params: { fields, date_preset, time_increment: '1', limit: '90' } }),
  ]);
  return {
    total: metricsOf(total.data?.[0]),
    daily: (daily.data || []).map((d) => ({ date: d.date_start, ...metricsOf(d) })),
  };
}

// تشغيلٌ وإيقافٌ للحملةِ كلِّها — تُنادى بقرارِ التاجرةِ وحدَها.
export async function setCampaignStatus(campaignId, status, token = ADS_DEV_TOKEN) {
  const s = status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
  await graph(`/${campaignId}`, { method: 'POST', token, body: { status: s } });
  return s;
}

// ───────────────────── المجرى كاملاً ─────────────────────

// حذفُ ما أُنشئَ حين يتعثّرُ المجرى بمنتصفِه. الحملةُ تُنشَأُ أوّلاً ثمّ المجموعةُ
// ثمّ التصميمُ ثمّ الإعلان، فإن سقطَ أحدُها بقيَ ما قبلَه معلّقاً في حسابِ التاجرةِ
// بلا أن تعرفَ به — حملاتٌ فارغةٌ تتراكمُ بعدَ كلِّ محاولةٍ فاشلة.
// التراجعُ بعدَ تعثّر: يُحذَفُ ما أُنشئ بالعكسِ (الإعلانُ قبلَ المجموعةِ قبلَ الحملة).
//
// وكان يستعملُ فعلَ DELETE وحدَه، فردّت ميتا «The user does not have permission for
// this action» على حملةٍ أنشأها التوكنُ نفسُه قبلَ ثوانٍ — فبقيت حملةٌ ومجموعةٌ
// فارغتانِ بحسابِ التاجرة، وهو بالضبطِ ما جاءَ التراجعُ ليمنعَه.
//
// والطريقُ المضمونُ عندَ ميتا هو **تغييرُ الحالةِ إلى DELETED بـPOST** لا فعلُ
// DELETE. فنبدأُ به، وDELETE يبقى محاولةً ثانيةً لما لا يقبلُ الحالة.
async function rollback(ids, token) {
  for (const id of ids.filter(Boolean).reverse()) {
    try {
      await graph(`/${id}`, { method: 'POST', token, body: { status: 'DELETED' } });
      continue;
    } catch (e1) {
      try {
        await graph(`/${id}`, { method: 'DELETE', token });
        continue;
      } catch (e2) {
        console.error('⚠️ تعذّر حذف', id, '—', e1.message, '/', e2.message);
      }
    }
  }
}

/**
 * من حملةٍ بطابورِ بازارا إلى إعلانٍ (أو عدّةِ إعلاناتٍ للمقارنة) موقوفٍ في الحسابِ
 * الإعلانيّ. يعيدُ المعرّفاتِ كي تُحفَظَ ويُفتَحَ بها Ads Manager.
 */
export async function publishCampaign({
  accountId, currency, pageId, igId, pixelId, imageBase64, videoUrl,
  name, goal, copies, link, audience, budget, days, startAt, placements,
}, token = ADS_DEV_TOKEN) {
  if (!token) throw new Error('لا يوجد توكن إعلانات على الخادم.');
  if (!pageId) throw new Error('لا توجد صفحة فيسبوك مربوطة — الإعلان يخرج من صفحة.');
  const list = (copies || []).filter((c) => c && (c.primary || c.headline));
  if (!list.length) throw new Error('لا يوجد نصّ للحملة.');

  // الميزانيّةُ بالوحدةِ الصغرى. العملاتُ بلا كسورٍ (JPY وأخواتُها) تُرسَلُ كما هي.
  const zeroDecimal = ['JPY', 'KRW', 'CLP', 'VND'];
  const minor = zeroDecimal.includes(currency) ? Math.round(budget) : Math.round(budget * 100);

  // الوسائطُ أوّلاً — قبلَ أن يُنشَأَ عندَ ميتا أيُّ شيءٍ يحتاجُ تراجعاً
  const imageHash = await uploadAdImage(accountId, imageBase64, token);
  const videoId = videoUrl ? await uploadAdVideo(accountId, videoUrl, token) : '';

  const campaign = await createCampaign(accountId, { name, goal, pixelId }, token);
  const made = [campaign.id];
  try {
    const [interestIds, cityKeys] = await Promise.all([
      resolveInterests(audience?.interests || [], token),
      resolveCities(audience?.cities || [], token),
    ]);
    const targeting = buildTargeting({ audience, cityKeys, placements, interestIds });
    const adset = await createAdSet(accountId, {
      name: `${name} — المجموعة`,
      campaignId: campaign.id,
      objective: campaign.objective,
      dailyBudgetMinor: minor,
      days,
      startAt,
      targeting,
      pageId, igId, pixelId,
    }, token);
    made.push(adset.id);

    // نسخةٌ واحدةٌ = إعلانٌ واحد. وللمقارنةِ: كلُّ نسخةٍ إعلانٌ بنفسِ المجموعة، فتقسمُ
    // ميتا الميزانيّةَ بينها أوّلاً ثمّ تدفعُ أكثرَها نحوَ النسخةِ التي تأتي بنتيجة.
    const ads = [];
    for (const [i, copy] of list.entries()) {
      const tag = list.length > 1 ? ` ${i + 1}` : '';
      const creative = await createCreative(accountId, {
        name: `${name} — التصميم${tag}`,
        pageId, igId, imageHash, videoId,
        message: copy.primary,
        headline: copy.headline,
        description: copy.cta,
        link,
        objective: campaign.objective,
      }, token);
      made.push(creative.id);
      const ad = await createAd(accountId, { name: `${name} — الإعلان${tag}`, adsetId: adset.id, creativeId: creative.id }, token);
      made.push(ad.id);
      ads.push(ad.id);
    }

    return {
      campaignId: campaign.id,
      adsetId: adset.id,
      adId: ads[0],
      adIds: ads,
      objective: campaign.objective,
      status: 'PAUSED',
      managerUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${String(accountId).replace('act_', '')}&selected_campaign_ids=${campaign.id}`,
    };
  } catch (err) {
    await rollback(made, token);
    throw err;
  }
}
