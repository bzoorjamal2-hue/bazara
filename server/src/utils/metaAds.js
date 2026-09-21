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
// «مبيعات» تُعيَّنُ إلى الزياراتِ عمداً: التحسينُ على الشراءِ يتطلّبُ بكسلاً على
// الموقعِ وحدثَ شراءٍ مُعرَّفاً، وبلا ذلك تتعلّمُ الحملةُ على لا شيءٍ وتصرفُ بلا
// نتيجة. حين يوجدُ البكسلُ نرقّيها.
const OBJECTIVE = {
  sales: 'OUTCOME_TRAFFIC',
  traffic: 'OUTCOME_TRAFFIC',
  messages: 'OUTCOME_ENGAGEMENT',
  awareness: 'OUTCOME_AWARENESS',
};

const OPTIMIZATION = {
  OUTCOME_TRAFFIC: { goal: 'LINK_CLICKS', billing: 'IMPRESSIONS' },
  OUTCOME_ENGAGEMENT: { goal: 'POST_ENGAGEMENT', billing: 'IMPRESSIONS' },
  OUTCOME_AWARENESS: { goal: 'REACH', billing: 'IMPRESSIONS' },
};

export async function createCampaign(accountId, { name, goal }, token = ADS_DEV_TOKEN) {
  const objective = OBJECTIVE[goal] || OBJECTIVE.traffic;
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

export async function createAdSet(accountId, opts, token = ADS_DEV_TOKEN) {
  const { name, campaignId, objective, dailyBudgetMinor, days, audience, pageId, countries } = opts;
  const opt = OPTIMIZATION[objective] || OPTIMIZATION.OUTCOME_TRAFFIC;
  const start = new Date(Date.now() + 10 * 60 * 1000); // بعدَ عشرِ دقائق
  const end = new Date(start.getTime() + Math.max(1, days) * 24 * 3600 * 1000);

  const targeting = {
    geo_locations: { countries: countries?.length ? countries : ['PS'] },
    // «الجمهور المتقدّم» يوسّعُ الاستهدافَ خارجَ ما اختارَتْه التاجرةُ حين يرى ميتا
    // فرصةً أفضل. نطفئُه: وعدُ التبويبِ أنّ الإعلانَ يذهبُ لمن حدّدَتْهُنّ هي —
    // وميزانيّةٌ صغيرةٌ تتبدّدُ على جمهورٍ لم تختَرْه أسوأُ من ميزانيّةٍ ضيّقة.
    targeting_automation: { advantage_audience: 0 },
    age_min: Math.max(13, Math.min(65, Number(audience?.ageMin) || 18)),
    age_max: Math.max(13, Math.min(65, Number(audience?.ageMax) || 45)),
  };
  const g = GENDERS[audience?.genders];
  if (g) targeting.genders = g;
  if (audience?.interestIds?.length) {
    targeting.flexible_spec = [{ interests: audience.interestIds.map((id) => ({ id })) }];
  }

  const body = {
    name: name.slice(0, 120),
    campaign_id: campaignId,
    status: 'PAUSED',
    // الميزانيّةُ بالوحدةِ الصغرى لعملةِ الحساب (سنتاً أو أغورة) — لا بالوحدةِ الكبرى
    daily_budget: String(Math.round(dailyBudgetMinor)),
    billing_event: opt.billing,
    optimization_goal: opt.goal,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    targeting,
  };
  if (opt.goal === 'POST_ENGAGEMENT' || objective === 'OUTCOME_ENGAGEMENT') body.promoted_object = { page_id: pageId };

  const r = await graph(`/${actId(accountId)}/adsets`, { method: 'POST', token, body });
  return { id: r.id, startTime: start, endTime: end };
}

export async function createCreative(accountId, opts, token = ADS_DEV_TOKEN) {
  const { name, pageId, igId, imageHash, message, headline, description, link, cta } = opts;
  const linkData = {
    image_hash: imageHash,
    link,
    message,
    name: headline,
    call_to_action: { type: cta || 'SHOP_NOW' },
  };
  if (description) linkData.description = description;

  const body = {
    name: name.slice(0, 120),
    object_story_spec: { page_id: pageId, link_data: linkData },
  };
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

// ───────────────────── الاهتماماتُ والنتائج ─────────────────────

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

export async function getAdInsights(adId, token = ADS_DEV_TOKEN) {
  const r = await graph(`/${adId}/insights`, {
    token,
    params: { fields: 'impressions,reach,clicks,spend,cpc,ctr', date_preset: 'maximum' },
  });
  const d = r.data?.[0] || {};
  return {
    impressions: Number(d.impressions) || 0,
    reach: Number(d.reach) || 0,
    clicks: Number(d.clicks) || 0,
    spend: Number(d.spend) || 0,
    cpc: Number(d.cpc) || 0,
    ctr: Number(d.ctr) || 0,
  };
}

// تشغيلٌ وإيقافٌ للحملةِ كلِّها — تُنادى بقرارِ التاجرةِ وحدَها.
export async function setCampaignStatus(campaignId, status, token = ADS_DEV_TOKEN) {
  const s = status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
  await graph(`/${campaignId}`, { method: 'POST', token, body: { status: s } });
  return s;
}

// ───────────────────── المجرى كاملاً ─────────────────────

/**
 * من حملةٍ بطابورِ بازارا إلى إعلانٍ موقوفٍ في الحسابِ الإعلانيّ.
 * يعيدُ المعرّفاتِ الأربعةَ كي تُحفَظَ ويُفتَحَ بها Ads Manager.
 */
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

export async function publishCampaign({
  accountId, currency, pageId, igId, imageBase64,
  name, goal, copy, link, audience, budget, days,
}, token = ADS_DEV_TOKEN) {
  if (!token) throw new Error('لا يوجد توكن إعلانات على الخادم.');
  if (!pageId) throw new Error('لا توجد صفحة فيسبوك مربوطة — الإعلان يخرج من صفحة.');

  // الميزانيّةُ بالوحدةِ الصغرى. العملاتُ بلا كسورٍ (JPY وأخواتُها) تُرسَلُ كما هي.
  const zeroDecimal = ['JPY', 'KRW', 'CLP', 'VND'];
  const minor = zeroDecimal.includes(currency) ? Math.round(budget) : Math.round(budget * 100);

  const imageHash = await uploadAdImage(accountId, imageBase64, token);
  const campaign = await createCampaign(accountId, { name, goal }, token);

  const made = [campaign.id];
  try {
  const interestIds = await resolveInterests(audience?.interests || [], token);
  const adset = await createAdSet(accountId, {
    name: `${name} — المجموعة`,
    campaignId: campaign.id,
    objective: campaign.objective,
    dailyBudgetMinor: minor,
    days,
    audience: { ...audience, interestIds },
    pageId,
    countries: ['PS'],
  }, token);

  made.push(adset.id);

  const creative = await createCreative(accountId, {
    name: `${name} — التصميم`,
    pageId, igId, imageHash,
    message: copy.primary,
    headline: copy.headline,
    description: copy.cta,
    link,
    cta: 'SHOP_NOW',
  }, token);

  made.push(creative.id);

  const ad = await createAd(accountId, {
    name: `${name} — الإعلان`,
    adsetId: adset.id,
    creativeId: creative.id,
  }, token);

  return {
    campaignId: campaign.id,
    adsetId: adset.id,
    creativeId: creative.id,
    adId: ad.id,
    status: 'PAUSED',
    managerUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${String(accountId).replace('act_', '')}&selected_campaign_ids=${campaign.id}`,
  };
  } catch (err) {
    await rollback(made, token);
    throw err;
  }
}
