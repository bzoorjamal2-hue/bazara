// ───────── قطعُ الكود المفقودة بعد النشر ─────────
//
// التطبيق يُقسَّم لقطعٍ اسم كلٍّ منها يحمل بصمةً (Dashboard-a1b2c3.js). كلّ
// نشرةٍ تولّد بصماتٍ جديدة وتحذف القديمة من الخادم.
//
// والصفحة المفتوحة عند النشر تبقى على الحزمة القديمة: فحين تُفتح شاشةٌ لم
// تُحمَّل قطعتها بعد، يطلب المتصفّح ملفاً لم يعد موجوداً — فيفشل الاستيراد
// الديناميكي بـ«Failed to fetch dynamically imported module»، وتتوقّف الشاشة
// عند رسالة خطأ لا مخرج منها. وservice worker بـautoUpdate يجعل هذا أسوأ:
// النسخة الجديدة جاهزة بالخلفية والصفحة ما تزال تعمل بالقديمة.
//
// العلاج: نلتقط هذا الفشل تحديداً ونعيد تحميل الصفحة مرّة واحدة — فتلتقط
// الحزمة الجديدة وتكمل. مرّةً واحدة فقط: لو تكرّر فالسبب غير النشر (انقطاع
// شبكة مثلاً) وإعادة التحميل بلا نهاية أسوأ من رسالة الخطأ.

const FLAG = 'bz_chunk_reloaded';

function isChunkError(err) {
  const m = String(err?.message || err || '');
  return (
    /Failed to fetch dynamically imported module/i.test(m) ||
    /Importing a module script failed/i.test(m) ||   // سفاري
    /error loading dynamically imported module/i.test(m) ||
    /ChunkLoadError/i.test(m)
  );
}

function reloadOnce() {
  let already = false;
  try { already = sessionStorage.getItem(FLAG) === '1'; } catch { /* تصفّح خاص */ }
  if (already) return false;
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* تجاهل */ }
  // نُبطل تسجيل الـservice worker القديم قبل التحميل كي لا يقدّم الحزمة
  // القديمة نفسها مرّةً أخرى فتتكرّر الحلقة.
  const done = () => window.location.reload();
  if (navigator.serviceWorker?.getRegistrations) {
    navigator.serviceWorker.getRegistrations()
      .then((rs) => Promise.all(rs.map((r) => r.update().catch(() => {}))))
      .finally(done);
  } else done();
  return true;
}

// يُغلَّف به كلّ import ديناميكي: lazy(() => retryImport(() => import('...')))
export function retryImport(loader) {
  return loader().catch((err) => {
    if (isChunkError(err) && reloadOnce()) {
      // نُعيد وعداً لا يُحلّ: الصفحة تُعاد تحميلها الآن، فلا داعي لعرض خطأ
      return new Promise(() => {});
    }
    throw err;
  });
}

// شبكة أمان لأي فشلٍ لم يمرّ عبر retryImport (استيراد داخل مكوّن مثلاً)
export function installChunkGuard() {
  if (typeof window === 'undefined') return;
  window.addEventListener('unhandledrejection', (e) => {
    if (isChunkError(e.reason)) reloadOnce();
  });
  // نجاح التحميل يمسح العلامة، فتبقى المحاولة متاحة للنشرة القادمة
  window.addEventListener('load', () => {
    try { sessionStorage.removeItem(FLAG); } catch { /* تجاهل */ }
  });
}
