// طابورُ الطلبات المتعثّرة.
//
// حفظُ الطلب قد يفشل: شبكةٌ تنقطع لحظةَ الضغط، أو خادمٌ يتعثّر. والرسالةُ تصل
// صاحبةَ المتجر على واتساب كاملةً — فالطلبُ ليس ضائعاً. لكنّه لا يدخل النظام:
// لا يظهر بلوحتها، ولا يُخصم المخزون، ولا تستطيع الزبونة تتبّعه.
//
// وكانت المعالجةُ الوحيدة أن تُخبَر الزبونة بذلك (وهو ما أضفتُه بشاشة الطلب).
// وهذه خطوةٌ أبعد: نحتفظ بالطلب هنا ونعيد إرساله حين تعود الشبكة، فيدخل
// النظامَ متأخّراً بلا أن يفعل أحدٌ شيئاً.
//
// ولماذا لا يُنشئ هذا طلباً مكرّراً: نُرسل معه مفتاحاً فريداً (idempotencyKey)،
// والخادمُ يتجاهل ما وصله بالمفتاح نفسه. فلو نجحت المحاولةُ الأولى ونحن نظنّها
// فشلت (انقطع الردّ لا الطلب)، لم تُسجَّل نسخةٌ ثانية.

const KEY = 'bz_order_queue';
const MAX = 10;          // ما يزيد على ذلك فالمشكلة أكبر من طابور
const MAX_AGE = 3 * 864e5; // ثلاثةُ أيّام: بعدها تكون التاجرة عالجته بواتساب

const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
};

const write = (list) => {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); } catch { /* ممتلئ */ }
};

/** مفتاحٌ فريد للطلب — يمنع التكرار عند إعادة الإرسال */
export function newKey() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch { /* متصفّحٌ قديم */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** يضيف طلباً تعثّر إرساله */
export function enqueue(payload) {
  const list = read().filter((x) => x.key !== payload.idempotencyKey);
  list.push({ key: payload.idempotencyKey, at: Date.now(), payload });
  write(list);
}

export function queueSize() {
  return read().length;
}

/**
 * يحاول إرسال ما بالطابور. يُستدعى عند العودة للاتّصال وعند فتح الموقع.
 * ما يُرفض بخطأ العميل (4xx) يُحذف: إعادتُه لن تنجح أبداً — قسيمةٌ انتهت أو
 * مخزونٌ نفد. وما يفشل بالشبكة أو بالخادم (5xx) يبقى للمحاولة القادمة.
 */
export async function flush(api) {
  const list = read();
  if (!list.length) return { sent: 0, left: 0 };

  const fresh = list.filter((x) => Date.now() - x.at < MAX_AGE);
  const keep = [];
  let sent = 0;

  for (const item of fresh) {
    try {
      await api.post('/orders/cod', item.payload);
      sent++;
    } catch (e) {
      const status = e?.response?.status;
      // 4xx: رفضٌ نهائيّ — لا نعيدها أبداً. غيرُ ذلك: نحتفظ بها.
      if (!(status >= 400 && status < 500)) keep.push(item);
    }
  }

  write(keep);
  return { sent, left: keep.length };
}

/** يبدأ المحاولات: عند العودة للاتّصال، وعند العودة للتبويب، ومرّةً بعد الإقلاع */
export function startOrderQueue(api) {
  if (typeof window === 'undefined') return;
  const go = () => { flush(api).catch(() => {}); };

  window.addEventListener('online', go);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
  // بعد الإقلاع لا أثناءه — لا نزاحم أوّل رسمة على شبكةٍ ضعيفة
  if (document.readyState === 'complete') setTimeout(go, 3000);
  else window.addEventListener('load', () => setTimeout(go, 3000));
}
