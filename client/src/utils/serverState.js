// ── هل المشكلة بشبكة الزبونة أم بخادمنا؟ ──
// الفرق ليس تجميلياً: كنّا نقول «فقدت الاتصال بالشبكة. تحقّق من اتصالك» بينما
// اتّصالُها سليمٌ تماماً والخادمُ هو الواقف. فتضيع دقائقُها بإعادة تشغيل الراوتر.
//
// ولماذا لا نعرف الفرق أصلاً؟ لأنّ ردّ 503 من api.bazarastore.site يأتي بلا
// ترويسات CORS (قِسْتُها: صفر ترويسة access-control)، فيحجبه المتصفّح عن
// الشيفرة ويصل axios كـERR_NETWORK — نفسَ شكلِ انقطاع الإنترنت تماماً.
//
// الحلّ: نسأل أصلَ الموقع نفسَه. ملفٌّ ساكن من نفس النطاق (Vercel) يصل حتى
// والخادمُ ميّت. فإن وصل: الإنترنت بخير والخادمُ هو المشكلة.
// ونتذكّرها بين التحميلات: الحالةُ تُكتشف بعد فشل أوّل طلب، أي بعد أن تكون
// الصفحةُ قد رُسمت فارغةً بالفعل — فأوّلُ تحميلٍ أثناء العطل يبقى فارغاً مهما
// فعلنا. بحفظ الرايةِ يعرف التحميلُ التالي من أوّل سطرٍ أنّ الخادمَ صامت،
// فيرسم النسخةَ المحفوظة فوراً بلا وميضِ فراغ. وتنتهي صلاحيتُها بعشر دقائق
// كي لا تعلق راية قديمة على موقعٍ عاد للعمل.
const FLAG = 'bz_srv_down';
const FLAG_TTL = 10 * 60 * 1000;
const readFlag = () => {
  try {
    const t = Number(localStorage.getItem(FLAG) || 0);
    return t > 0 && Date.now() - t < FLAG_TTL;
  } catch { return false; }
};

let down = readFlag();
const subs = new Set();

export const isServerDown = () => down;
export function subscribeServerDown(cb) { subs.add(cb); return () => subs.delete(cb); }
function set(v) {
  // الخروجُ أوّلاً: markServerUp تُستدعى مع كلّ ردٍّ ناجح، فلو كتبنا للتخزين
  // قبل الفحص لصار كلُّ طلبٍ يحمل عمليةَ تخزينٍ متزامنةً بلا داعٍ.
  if (down === v) return;
  try { if (v) localStorage.setItem(FLAG, String(Date.now())); else localStorage.removeItem(FLAG); } catch { /* ممتلئ */ }
  down = v;
  subs.forEach((cb) => { try { cb(); } catch { /* مشترِكٌ معطوب لا يوقف الباقين */ } });
}

export const markServerUp = () => set(false);

// نتحقّق قبل أن نتّهم الشبكة. أسوأُ حالة: الملفّ لا يصل أيضاً → المشكلة شبكةٌ
// فعلاً ونترك الرسالة القديمة.
let probing = null;
export function markServerDown() {
  if (down) return Promise.resolve(true);
  if (probing) return probing;
  probing = (async () => {
    try {
      // no-store وطابعٌ زمنيّ: لا نريد جواباً من الكاش يخدعنا
      await fetch(`/favicon.ico?_p=${Date.now()}`, { cache: 'no-store' });
      set(true);
      return true;
    } catch {
      set(false); // الأصلُ نفسُه لا يصل → شبكةُ الجهاز
      return false;
    } finally {
      probing = null;
    }
  })();
  return probing;
}
