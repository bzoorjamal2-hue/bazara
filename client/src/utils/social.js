// ─────────────── روابط التواصل: تفتح التطبيق لا المتصفّح ───────────────
//
// كان الرابط `https://facebook.com/<handle>` بـtarget="_blank" وحده. على
// الجوّال يفتح ذلك المتصفّح (وداخل تطبيقنا المغلّف: متصفّحاً داخلياً)، فتصل
// الزبونة إلى صفحةٍ تطلب منها تسجيل الدخول من جديد بدل أن تجد نفسها في
// التطبيق الذي هي مسجّلة دخولها فيه أصلاً.
//
// الحلّ بلا أي إضافةٍ أصلية: نحاول فتح رابط التطبيق (fb:// أو instagram://)
// ثم نراقب — إن غادرت الصفحةُ المقدّمة فقد فُتح التطبيق ونتوقّف، وإن بقيت
// ظاهرة بعد مهلةٍ قصيرة فالتطبيق غير مركّب ونفتح الويب. هذا هو النمط
// المتعارف عليه للروابط العميقة، ويتدهور بلطف على سطح المكتب.

const strip = (v) => String(v || '').trim().replace(/^@/, '');

// من المُدخَل (اسم مستخدم أو رابط كامل) إلى اسم المستخدم وحده
function handleOf(value, host) {
  const v = strip(value);
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) return v.replace(/\/+$/, '');
  try {
    const u = new URL(v);
    if (!u.hostname.includes(host)) return '';
    // أول جزءٍ من المسار هو الحساب: /bazara أو /bazara/photos
    return decodeURIComponent(u.pathname.split('/').filter(Boolean)[0] || '');
  } catch {
    return '';
  }
}

// الرابط الويبّي القانونيّ. نستعمل www. عمداً: روابط iOS/Android الشاملة
// (Universal Links / App Links) مسجّلة على هذا النطاق تحديداً، فيلتقطها
// التطبيق تلقائياً حتى قبل أن نصل إلى حيلة fb://.
export function socialWebUrl(kind, value) {
  const v = strip(value);
  if (!v) return '';
  const host = kind === 'instagram' ? 'instagram.com' : 'facebook.com';
  // نُقنِّن الروابط الكاملة أيضاً: رابط ملصوق من الجوّال يأتي غالباً بـ
  // m.facebook.com أو بلا www، وروابطُ النظام الشاملة غير مسجّلة على تلك
  // النطاقات — فيفتحه المتصفّح ويبقى التطبيق مقفلاً. نُعيد بناءه دائماً.
  const h = handleOf(v, host) || (/^https?:\/\//i.test(v) ? '' : v.replace(/\/+$/, ''));
  if (!h) return /^https?:\/\//i.test(v) ? v : ''; // رابط لنطاقٍ آخر: نتركه كما هو
  return `https://www.${host}/${encodeURIComponent(h)}`;
}

// رابط التطبيق الأصلي، أو '' إن تعذّر استخراج الحساب
function appUrl(kind, value) {
  if (kind === 'instagram') {
    const h = handleOf(value, 'instagram.com');
    return h ? `instagram://user?username=${encodeURIComponent(h)}` : '';
  }
  // فيسبوك: facewebmodal يقبل رابطاً كاملاً فيعمل مع أسماء المستخدمين،
  // بينما fb://profile يتطلّب معرّفاً رقمياً لا نملكه.
  const web = socialWebUrl('facebook', value);
  return web ? `fb://facewebmodal/f?href=${encodeURIComponent(web)}` : '';
}

const isMobile = () => typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

// يفتح الحساب: التطبيق أولاً، والويب إن لم يُفتح خلال المهلة.
export function openSocial(kind, value, event) {
  const web = socialWebUrl(kind, value);
  if (!web) return;
  const app = isMobile() ? appUrl(kind, value) : '';
  // على سطح المكتب (أو تعذّر بناء رابط التطبيق) نترك الرابط يعمل كما هو
  if (!app) return;

  event?.preventDefault();

  let done = false;
  const finish = () => {
    done = true;
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
  };
  // اختفاء الصفحة = التطبيق فُتح فعلاً، فلا نفتح الويب فوقه
  const onHide = () => { if (document.hidden) finish(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);

  window.location.href = app;

  // 900ms: أطول من زمن انتقال النظام للتطبيق، وأقصر من أن تُحسّ انتظاراً
  setTimeout(() => {
    if (done || document.hidden) return;
    finish();
    window.location.href = web;
  }, 900);
}
