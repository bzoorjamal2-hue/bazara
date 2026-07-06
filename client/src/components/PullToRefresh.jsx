import { useEffect, useRef, useState } from 'react';
import { isStandalone } from '../utils/pwa.js';

// سحب-للتحديث (Pull to refresh) زي التطبيقات: اسحبي الشاشة من الأعلى → تظهر علامة
// تحديث دوّارة، وعند تجاوز الحدّ يُعاد تحميل الصفحة. مفعّل داخل التطبيق المثبّت فقط
// (المتصفّح فيه سحب-تحديث أصلي فلا نُكرّره).
//
// ملاحظة أداء مهمة: مستمع touchmove غير السلبي (اللازم لـ preventDefault) يجبر
// المتصفح على انتظار الجافاسكربت قبل كل فريم تمرير — كان مركّباً دائماً فيبطّئ
// تمرير التطبيق كله. الآن يُركّب فقط لحظة بدء سحبة مؤهّلة (من قمة الصفحة تماماً)
// ويُزال فور انتهائها، والتمرير العادي لا يمرّ عليه إطلاقاً. كما تُقرأ الحالة من
// refs كي تُسجَّل المستمعات مرة واحدة (كانت تُعاد مع كل بكسل سحب).
const THRESHOLD = 70;
const MAX = 120;

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const movingRef = useRef(false); // مستمع touchmove مركّب حالياً؟

  useEffect(() => {
    if (!isStandalone()) return undefined;
    // قفل التمرير (نافذة/درج مفتوح) يجعل body ثابتاً position:fixed — عندها نعطّل
    // سحب-التحديث كي لا ينطلق أثناء التمرير داخل المنبثقة فيغلقها بإعادة التحميل.
    const isLocked = () => document.body.style.position === 'fixed';

    const setPullBoth = (v) => { pullRef.current = v; setPull(v); };

    const onMove = (e) => {
      if (startY.current == null || refreshingRef.current || isLocked()) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        const d = Math.min(MAX, dy * 0.5); // مقاومة لطيفة
        setPullBoth(d);
        if (d > 4) e.preventDefault(); // امنعي ارتداد الصفحة أثناء السحب
      } else if (dy <= 0) {
        detachMove();
        startY.current = null;
        setPullBoth(0);
      }
    };
    const attachMove = () => {
      if (movingRef.current) return;
      movingRef.current = true;
      window.addEventListener('touchmove', onMove, { passive: false });
    };
    const detachMove = () => {
      if (!movingRef.current) return;
      movingRef.current = false;
      window.removeEventListener('touchmove', onMove);
    };

    const onStart = (e) => {
      if (window.scrollY > 0 || refreshingRef.current || isLocked()) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
      attachMove(); // فقط الآن (لمسة تبدأ من القمة) نراقب الحركة
    };
    const onEnd = () => {
      detachMove();
      if (startY.current == null) return;
      const reached = pullRef.current >= THRESHOLD;
      startY.current = null;
      if (reached && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullBoth(THRESHOLD);
        setTimeout(() => window.location.reload(), 500);
      } else {
        setPullBoth(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
      detachMove();
    };
  }, []); // تسجيل واحد فقط — الحالة الحيّة عبر refs

  const show = pull > 0 || refreshing;
  const y = refreshing ? THRESHOLD : pull;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div
        className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-wine shadow-lg ring-1 ring-wine/10"
        style={{
          transform: `translateY(${show ? Math.max(-4, y - 16) : -60}px)`,
          opacity: show ? 1 : 0,
          transition: startY.current ? 'opacity .15s' : 'transform .3s ease, opacity .3s',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: refreshing ? 'none' : `rotate(${pull * 4}deg)` }}
          fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-2.6-6.4" />
          <path d="M21 3.5v5h-5" />
        </svg>
      </div>
    </div>
  );
}
