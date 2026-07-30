import { useEffect, useRef, useState } from 'react';

// «ظهر مرة واحدة» — مراقب تقاطع مشترك (Singleton) لكل عناصر الموقع: بدل إنشاء
// IntersectionObserver لكل بطاقة (مكلف مع عشرات البطاقات)، نستخدم مراقباً واحداً
// يخدم الجميع عبر خريطة عنصر→دالة. يُفصل العنصر فور ظهوره (مرّة واحدة، بلا كلفة
// مستمرة). يحترم تقليل الحركة تلقائياً (يظهر فوراً بلا حركة).
let io = null;
const cbs = new WeakMap();

function ensureObserver() {
  if (io || typeof IntersectionObserver === 'undefined') return io;
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const fn = cbs.get(e.target);
          io.unobserve(e.target);
          cbs.delete(e.target);
          if (fn) fn();
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
  );
  return io;
}

export default function useInViewOnce() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // تقليل الحركة أو غياب الدعم → ظهور فوري بلا مراقبة
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(true); return undefined; }
    // فوق الطية أصلاً وقت التركيب؟ نُظهره فوراً بلا انتظار تمرير
    if (el.getBoundingClientRect().top < window.innerHeight * 0.96) { setShown(true); return undefined; }
    const obs = ensureObserver();
    if (!obs) { setShown(true); return undefined; }
    cbs.set(el, () => setShown(true));
    obs.observe(el);
    return () => { obs.unobserve(el); cbs.delete(el); };
  }, []);

  return [ref, shown];
}
