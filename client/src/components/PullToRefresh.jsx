import { useEffect, useRef, useState } from 'react';
import { isStandalone } from '../utils/pwa.js';

// سحب-للتحديث (Pull to refresh) زي التطبيقات: اسحبي الشاشة من الأعلى → تظهر علامة
// تحديث دوّارة، وعند تجاوز الحدّ يُعاد تحميل الصفحة. مفعّل داخل التطبيق المثبّت فقط
// (المتصفّح فيه سحب-تحديث أصلي فلا نُكرّره).
const THRESHOLD = 70;
const MAX = 120;

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);

  useEffect(() => {
    if (!isStandalone()) return undefined;
    const onStart = (e) => {
      if (window.scrollY > 0 || refreshing) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e) => {
      if (startY.current == null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        const d = Math.min(MAX, dy * 0.5); // مقاومة لطيفة
        setPull(d);
        if (d > 4) e.preventDefault(); // امنعي ارتداد الصفحة أثناء السحب
      } else if (dy <= 0) {
        startY.current = null;
        setPull(0);
      }
    };
    const onEnd = () => {
      if (startY.current == null) return;
      const reached = pull >= THRESHOLD;
      startY.current = null;
      if (reached && !refreshing) {
        setRefreshing(true);
        setPull(THRESHOLD);
        setTimeout(() => window.location.reload(), 500);
      } else {
        setPull(0);
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [pull, refreshing]);

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
