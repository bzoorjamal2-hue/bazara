// ───────── قطعُ الكودِ المفقودةُ بعدَ النشر ─────────
//
// التطبيقُ يُقسَّمُ لقطعٍ اسمُ كلٍّ منها يحملُ بصمةً (Dashboard-a1b2c3.js). كلُّ نشرةٍ
// تولّدُ بصماتٍ جديدةً وتُهمِلُ القديمة، والخادمُ يردُّ على أيِّ ملفٍّ مفقودٍ بصفحةِ
// index.html (قاعدةُ تطبيقِ الصفحةِ الواحدة). فالصفحةُ المفتوحةُ — أو نسخةُ الـservice
// worker المخزّنةُ في الجهاز — تطلبُ قطعةً لم تعُد موجودةً فتتلقّى HTML مكانَ
// جافاسكربت، فينهارُ الاستيرادُ الديناميكيّ.
//
// وقعت هذه بالضبطِ في شاشةِ المحادثة: قطعتُها كانت تستوردُ قطعةَ شاشةِ الصندوق،
// وتلك رجعت HTML، فصار `Avatar` و`ConvertForm` غيرَ معرّفَين وسقطت React بـ
// «Element type is invalid». (فُصِلَ المشتركُ بعدَها إلى components/OrderComposer.jsx.)
//
// العلاجُ هنا: تحميلةٌ واحدةٌ تُنظّفُ كلَّ شيء. وواحدةٌ فقط — لأنّ التحميلَ المتكرّرَ
// هو الوميضُ الذي رآه المستخدم: انهيارٌ ← تحميلٌ ← انهيارٌ، عشراتِ المرّاتِ في الدقيقة.

const FLAG = 'bz_chunk_reloaded';

// رسائلُ فشلِ الوحدةِ تختلفُ بين المحرّكات، ولا يكفي نمطٌ أو اثنان:
//  • كروم: Failed to fetch dynamically imported module
//  • كروم حين يصلُ HTML مكانَ JS: Expected a JavaScript module script but the
//    server responded with a MIME type of text/html — وهذه حالتُنا، وكانت تفلتُ
//    من الحارسِ القديمِ كلَّها فتصلُ إلى شاشةِ الخطأ.
//  • سفاري: Importing a module script failed / Load failed / Unable to load
function isChunkError(err) {
  const m = String(err?.message || err?.reason?.message || err || '');
  return (
    /Failed to fetch dynamically imported module/i.test(m) ||
    /Importing a module script failed/i.test(m) ||
    /error loading dynamically imported module/i.test(m) ||
    /Failed to load module script/i.test(m) ||
    /Expected a JavaScript(?: or WebAssembly)? module script/i.test(m) ||
    /MIME type of .?text\/html/i.test(m) ||
    /ChunkLoadError/i.test(m) ||
    /\bLoad failed\b/i.test(m) ||
    /Unable to (?:load|preload)/i.test(m) ||
    /dynamically imported module/i.test(m)
  );
}

// فحصٌ نقيٌّ بلا أثر: هل بقيت لنا تحميلةٌ تلقائيّةٌ في هذه الجلسة؟ يُستعمَلُ قبلَ
// الرسمِ لنقرّرَ: أنعرضُ شاشةَ الخطأِ أم نصمتُ لأنّ الصفحةَ ستُحمَّلُ الآن.
export function canReloadOnce() {
  try { return sessionStorage.getItem(FLAG) !== '1'; } catch { return true; }
}

export function reloadOnce() {
  let already = false;
  try { already = sessionStorage.getItem(FLAG) === '1'; } catch { /* تصفّحٌ خاصّ */ }
  if (already) return false;
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* تجاهل */ }

  // لا يكفي تحديثُ الـservice worker: ما دام يعملُ فقد يخدمُ index.html قديماً يشيرُ
  // إلى قطعٍ مفقودة، فيتكرّرُ الانهيارُ بعدَ كلِّ تحميلة. نُلغي تسجيلَه ونُفرغُ خزائنَه،
  // فتُجلَبُ الصفحةُ والقطعُ كلُّها من الشبكةِ متّسقة. ويُسجَّلُ من جديدٍ عندَ الإقلاع.
  const done = () => { try { window.location.reload(); } catch { /* تجاهل */ } };
  const clean = [];
  if (typeof caches !== 'undefined' && caches?.keys) {
    clean.push(caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k).catch(() => {}))))
      .catch(() => {}));
  }
  if (navigator.serviceWorker?.getRegistrations) {
    clean.push(navigator.serviceWorker.getRegistrations()
      .then((rs) => Promise.all(rs.map((r) => r.unregister().catch(() => {}))))
      .catch(() => {}));
  }
  // لا ننتظرُ التنظيفَ إلى الأبد: لو تعثّرَ أحدُ الوعودِ بقيت الصفحةُ معلّقةً بيضاء.
  if (clean.length) {
    let fired = false;
    const once = () => { if (!fired) { fired = true; done(); } };
    Promise.all(clean).finally(once);
    setTimeout(once, 3000);
  } else done();
  return true;
}

// يُغلَّفُ به كلُّ استيرادٍ ديناميكي: lazy(() => retryImport(() => import('...')))
export function retryImport(loader) {
  return loader().catch((err) => {
    if (isChunkError(err) && reloadOnce()) {
      // وعدٌ لا يُحَلّ: الصفحةُ تُعادُ الآن، فلا داعيَ لعرضِ خطأٍ يومضُ ثمّ يختفي
      return new Promise(() => {});
    }
    throw err;
  });
}

// شبكةُ أمانٍ لأيِّ فشلٍ لم يمرَّ عبرَ retryImport (استيرادٌ داخلَ مكوّن، أو تحميلٌ
// مسبقٌ يفشلُ قبلَ أن يصلَ إلينا). كانت في main.jsx نسخةٌ ثانيةٌ من هذا الحارسِ بعلمٍ
// مختلف (bz_chunk_reload) — فكان لكلِّ حارسٍ تحميلتُه، أي تحميلتان لا واحدة، وكلٌّ
// يُبطلُ حسابَ الآخر. صار الحارسُ واحداً وعلمُه واحد.
export function installChunkGuard() {
  if (typeof window === 'undefined') return;
  window.addEventListener('unhandledrejection', (e) => {
    if (isChunkError(e.reason)) reloadOnce();
  });
  window.addEventListener('error', (e) => {
    // فشلُ وسمِ <script type="module"> لا يمرُّ بـunhandledrejection
    if (e?.target?.tagName === 'SCRIPT' || isChunkError(e?.error || e?.message)) {
      if (e?.target?.tagName !== 'SCRIPT' || String(e.target.src || '').includes('/assets/')) reloadOnce();
    }
  }, true);
  window.addEventListener('vite:preloadError', () => { reloadOnce(); });

  // العلامةُ تُمسَحُ بعدَ أن تثبتَ الصفحةُ لا بمجرّدِ تحميلِها.
  //
  // كانت تُمسَحُ عندَ حدثِ load، وهو يقعُ **قبلَ** أن يُرسَمَ ما ينهار. فكلُّ تحميلةٍ
  // تمسحُ العلامةَ ثمّ تنهارُ ثمّ تُحمَّلُ من جديد — وميضٌ بين شاشةِ الانتظارِ والصفحةِ
  // لا يتوقّف، وهو ما وقع. خمسَ عشرةَ ثانيةً بلا انهيارٍ تعني أنّ التحميلةَ نجحت،
  // فتُمسَحُ العلامةُ حينَها وتبقى المحاولةُ متاحةً للنشرةِ القادمة.
  const arm = () => setTimeout(() => {
    try { sessionStorage.removeItem(FLAG); } catch { /* تجاهل */ }
  }, 15000);
  if (document.readyState === 'complete') arm();
  else window.addEventListener('load', arm);
}
