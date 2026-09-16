import { useEffect, useRef, useState } from 'react';
import { createIntent, readIntent } from '../utils/scrollIntent.js';

/* ═══════ الهيدر ينزلق بالنزول ويعود بأيّ رفعة ═══════
   نظامُ التطبيقات العالميّة (إنستغرام · تويتر): الشريطُ العلويّ ليس ضريبةً دائمةً
   على ثلث الشاشة. ينزلق لفوق حين تنزل الزبونةُ لتتصفّح، ويعود بأصغرِ رفعةٍ لأنّ
   الرفعَ نيّةُ عودةٍ لا حركةً عابرة.

   القرارُ كلُّه في utils/scrollIntent — منطقٌ نقيٌّ مختبَر. وهنا التوصيلُ وحدَه:
   قراءةٌ واحدةٌ بالفريم (rAF) كي لا نحسب على كلّ حدثِ تمرير. */

export default function useHideOnScroll({ paused = false, resetKey } = {}) {
  const [hidden, setHidden] = useState(false);
  const mem = useRef(createIntent(0));

  // تغيّرُ الصفحة يُرجع الشريط: الزائرةُ تصل رأسَ صفحةٍ جديدة، فلا تجدُ شريطاً
  // مخفيّاً ورثته عن صفحةٍ غادرتها.
  useEffect(() => {
    mem.current = createIntent(window.scrollY);
    setHidden(false);
  }, [resetKey]);

  useEffect(() => {
    // درجٌ أو قائمةٌ مفتوحة → الشريطُ ظاهرٌ ولا نقيس شيئاً
    if (paused) { setHidden(false); return undefined; }
    let ticking = false;
    const read = () => {
      ticking = false;
      // قفلُ التمرير (useScrollLock) يثبّت body فيصير scrollY صفراً زائفاً —
      // نتجاهل الحدثَ كي لا «يقفز» الشريطُ خلف الدرج.
      if (document.body.style.position === 'fixed') return;
      const next = readIntent(mem.current, window.scrollY);
      if (next !== null) setHidden(next);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(read); } };
    mem.current.lastY = window.scrollY;
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [paused]);

  return hidden;
}
