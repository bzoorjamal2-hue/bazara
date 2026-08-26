import { useEffect, useRef, useState } from 'react';

// عدّاد تصاعدي ناعم — يعطي الأرقام إحساساً حيّاً عند ظهورها (لوحة المدير + التجّار).
// يبدأ العدّ فقط عند دخول الرقم للشاشة (مراقب تقاطع)، ويحترم تقليل الحركة.
// value: الرقم النهائي. format: دالة تنسيق (عملة/فواصل...). duration بالمللي ثانية.
export default function CountUp({ value = 0, format = (n) => Math.round(n).toLocaleString(), duration = 850 }) {
  const target = Number(value) || 0;
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    // القيمة الجديدة تُلغي «سبق أن عددت»: أرقام تصل بعد الرسم الأول (نداء
    // شبكة) كانت تجد started=true من عدّةٍ سابقة على صفر، فيرفض العدّاد
    // العدّ ويبقى صفراً إلى الأبد رغم وصول الرقم الصحيح.
    started.current = false;

    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') { setN(target); return undefined; }

    const run = () => {
      if (started.current) return;
      started.current = true;
      let raf;
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        setN(target * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
        else setN(target);
      };
      raf = requestAnimationFrame(tick);
      cleanup.raf = () => raf && cancelAnimationFrame(raf);
    };
    const cleanup = { raf: null };

    if (!el) { run(); return () => cleanup.raf?.(); }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    // شبكة أمان: المراقب لا يُطلق في صفحةٍ لا تُرسم (تبويب بالخلفية، لقطة
    // آلية، مستعرض داخل تطبيق). بلا هذه يبقى الرقم صفراً — وصفرٌ معروض
    // أسوأ من رقمٍ بلا حركة، لأنّه يبدو حقيقةً لا انتظاراً.
    const failsafe = setTimeout(() => { if (!started.current) { started.current = true; setN(target); } }, 1200);
    return () => { clearTimeout(failsafe); io.disconnect(); cleanup.raf?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // العدد الجزئي يُنسَّق كصحيح أثناء العدّ ما لم يُطلب غير ذلك (نمرّر الرقم كاملاً)
  return <span ref={ref}>{format(n)}</span>;
}
