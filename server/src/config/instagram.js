import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// تكامل رسائل إنستغرام المباشرة (Instagram Messaging API عبر Meta Graph)
// الفكرة: كل تاجر عنده حساب Instagram Business مربوط بصفحة فيسبوك. بعد ربطه هنا،
// كل رسالة خاصة (DM) تصل حسابه تُرسَل لِـ webhook بازارا، فتظهر بصندوق داخل لوحته،
// ويقدر يردّ عليها أو يحوّلها لطلب مباشرة. التوكن يُخزّن مشفّراً (نفس crypto أوبتيموس).

// إصدار Graph API — ثابت حتى لا يتغيّر السلوك فجأة عند ترقية Meta لواجهتها.
export const GRAPH = `https://graph.facebook.com/${process.env.IG_GRAPH_VERSION || 'v21.0'}`;

// معرّف التطبيق عام (يُستخدم بتدفّق تسجيل الدخول بالواجهة) فلا بأس بكشفه. السرّ يبقى خادمياً فقط.
export const APP_ID = process.env.IG_APP_ID || '';
export const GRAPH_VERSION = process.env.IG_GRAPH_VERSION || 'v21.0';
// معرّف إعداد «تسجيل الدخول للأعمال» (Facebook Login for Business) — هذا النوع من
// التطبيقات لا يقبل scope القديم، بل يتطلّب config_id يجمع الصلاحيات والأصول. عام أيضاً.
export const LOGIN_CONFIG_ID = process.env.IG_LOGIN_CONFIG_ID || '';
const APP_SECRET = process.env.IG_APP_SECRET || '';
// نستخدمه للتحقق من طلب اشتراك الـ webhook (GET) — نضبطه نفسه في لوحة Meta.
export const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN || '';

// التكامل "نائم" حتى يضبط المشرف مفاتيح تطبيق بازارا على Meta (نفس منطق أوبتيموس/لحظة).
export function isInstagramConfigured() {
  return Boolean(APP_ID && APP_SECRET && VERIFY_TOKEN);
}

// ───────── التحقق من توقيع الـ webhook (X-Hub-Signature-256) ─────────
// Meta توقّع جسم الطلب الخام بـ HMAC-SHA256 بمفتاح app secret. نرفض أي طلب توقيعه
// لا يطابق — فلا يقدر أحد يزوّر رسائل واردة على الخادم. يحتاج الجسم الخام (req.rawBody).
export function verifySignature(rawBody, header) {
  if (!APP_SECRET || !header || !rawBody) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ───────── استدعاء عام لِـ Graph API ─────────
async function graph(path, { method = 'GET', token, params, body } = {}) {
  const url = new URL(`${GRAPH}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (token) url.searchParams.set('access_token', token);
  const opts = { method, headers: { Accept: 'application/json' } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.message || `Graph ${res.status}`);
    e.status = res.status;
    e.body = data;
    throw e;
  }
  return data;
}

// ───────── تدفّق الربط (OAuth) ─────────
// الواجهة تسجّل دخول فيسبوك (FB JS SDK) وتُرسل لنا توكن المستخدم قصير العمر. نحوّله
// لتوكن طويل العمر، نجلب صفحات المستخدم وحساب إنستغرام المرتبط بكل صفحة، ثم نشترك
// بالـ webhook لتلك الصفحة. توكن الصفحة (طويل العمر) هو ما نخزّنه ونرسل به الردود.

// 0) تبديل رمز التفويض (code) القادم من إعادة التوجيه بتوكن مستخدم — redirect_uri
// يجب أن يطابق تماماً الذي طُلب به الدخول، وإلا ترفض Meta التبديل.
export async function exchangeCodeForToken(code, redirectUri) {
  const data = await graph('/oauth/access_token', {
    params: {
      client_id: APP_ID,
      client_secret: APP_SECRET,
      redirect_uri: redirectUri,
      code,
    },
  });
  return data.access_token;
}

// 1) توكن مستخدم قصير → طويل العمر (~60 يوم)
export async function exchangeLongLivedToken(userToken) {
  const data = await graph('/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: userToken,
    },
  });
  return data.access_token;
}

// 2) صفحات المستخدم + حساب إنستغرام Business المربوط بكل صفحة + توكن كل صفحة
export async function getManagedPages(userToken) {
  const data = await graph('/me/accounts', {
    token: userToken,
    params: { fields: 'name,access_token,instagram_business_account{id,username}' },
  });
  return (data.data || [])
    .filter((p) => p.instagram_business_account?.id)
    .map((p) => ({
      pageId: p.id,
      pageName: p.name || '',
      pageToken: p.access_token,
      igUserId: p.instagram_business_account.id,
      igUsername: p.instagram_business_account.username || '',
    }));
}

// 3) اشتراك تطبيق بازارا برسائل هذه الصفحة — بدونه لا يصلنا أي webhook
export async function subscribePageMessages(pageId, pageToken) {
  return graph(`/${pageId}/subscribed_apps`, {
    method: 'POST',
    token: pageToken,
    params: { subscribed_fields: 'messages,messaging_postbacks' },
  });
}

// إلغاء الاشتراك عند فصل المتجر (تنظيف — لا يفشل الفصل لو تعذّر)
export async function unsubscribePageMessages(pageId, pageToken) {
  return graph(`/${pageId}/subscribed_apps`, { method: 'DELETE', token: pageToken });
}

// ───────── الرسائل ─────────
// إرسال ردّ نصّي للزبون. recipientId هو IGSID (معرّف المُرسِل ضمن هذه الصفحة).
export async function sendMessage(pageToken, recipientId, text) {
  return graph('/me/messages', {
    method: 'POST',
    token: pageToken,
    body: { recipient: { id: recipientId }, message: { text } },
  });
}

// الردُّ على رسالةٍ بعينِها: نفسُ نداءِ الإرسالِ ومعه معرّفُ المقتبَسة، فيظهرُ عند
// الزبونِ ردّاً على كلامِه لا رسالةً معلّقةً في الهواء.
export async function sendReplyTo(pageToken, recipientId, text, mid) {
  return graph('/me/messages', {
    method: 'POST',
    token: pageToken,
    body: { recipient: { id: recipientId }, message: { text }, reply_to: { mid } },
  });
}

// تفاعلٌ على رسالة (❤️). reaction فارغاً يعني إزالةَ التفاعل.
export async function sendReaction(pageToken, recipientId, mid, reaction) {
  return graph('/me/messages', {
    method: 'POST',
    token: pageToken,
    body: reaction
      ? { recipient: { id: recipientId }, sender_action: 'react', payload: { message_id: mid, reaction } }
      : { recipient: { id: recipientId }, sender_action: 'unreact', payload: { message_id: mid } },
  });
}

// إرسال صورة. إنستغرام لا تقبل أن نرفع إليها الملفّ، بل تطلب رابطاً عامّاً تجلبه هي
// بنفسها — فترفع الواجهةُ الصورةَ إلى Cloudinary أوّلاً ويصل الرابطُ هنا. ورسالةٌ
// واحدةٌ لا تحمل نصّاً ومرفقاً معاً، فمن أراد الاثنين أرسل رسالتين.
export async function sendAttachment(pageToken, recipientId, url, type = 'image') {
  return graph('/me/messages', {
    method: 'POST',
    token: pageToken,
    body: {
      recipient: { id: recipientId },
      message: { attachment: { type, payload: { url, is_reusable: true } } },
    },
  });
}

// اسم/معرّف الزبون من IGSID — لعرضه بصندوق الرسائل بدل رقم مجرّد.
// حقلٌ واحدٌ غيرُ مدعومٍ يُسقطُ الطلبَ كلَّه عند Meta، وحقولُ الملفّ تختلفُ باختلافِ
// الصلاحيّات الممنوحة — فلو سقط الطلبُ بالصورة أعدناه بالاسمِ وحدَه بدل أن نخسرَ
// الاسمَ أيضاً ويبقى الزبونُ رقماً مجرّداً.
export async function getSenderProfile(pageToken, igsid) {
  const ask = (fields) => graph(`/${igsid}`, { token: pageToken, params: { fields } });
  let data = null;
  try {
    data = await ask('name,username,profile_pic');
  } catch {
    try {
      data = await ask('name,username');
    } catch {
      return { name: '', username: '', avatar: '' };
    }
  }
  return { name: data.name || '', username: data.username || '', avatar: data.profile_pic || '' };
}

// روابطُ Meta للمرفقاتِ وصورِ البروفايل موقّعةٌ وتنتهي صلاحيّتُها بعد أيّام، فما يُحفَظُ
// منها في قاعدتنا يصيرُ مربّعاً مكسوراً بعد حين. Cloudinary تقبلُ رابطاً بدل ملفّ
// وتجلبُه بنفسها، فننسخُ الصورةَ عندنا مرّةً واحدةً ونحفظُ رابطَنا الدائم.
// المفتاحُ عامٌّ (رفعٌ بلا توقيع) وهو نفسُه الذي في واجهةِ المتجر.
const CLD_CLOUD = process.env.CLOUDINARY_CLOUD || 'dkzrnu4cs';
const CLD_PRESET = process.env.CLOUDINARY_PRESET || 'bazara_unsigned';

export async function mirrorRemote(url, folder = 'ig') {
  if (!url || !CLD_CLOUD || !CLD_PRESET) return url;
  try {
    const form = new URLSearchParams({ file: url, upload_preset: CLD_PRESET, folder });
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLD_CLOUD}/auto/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    return data.secure_url || url; // فشلُ النسخِ لا يُضيّعُ الرسالة: نُبقي رابطَ Meta
  } catch {
    return url;
  }
}
