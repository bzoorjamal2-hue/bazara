import { useEffect, useRef, useState } from 'react';

// ظهور تدريجي عند دخول العنصر للشاشة (fade + slide up) — لمسة فخامة حديثة.
// خفيف: IntersectionObserver واحد لكل عنصر، يُفصل فور الظهور (مرّة واحدة، بلا تكلفة
// مستمرة). يحترم تفضيل تقليل الحركة تلقائياً عبر CSS. delay اختياري لتتابع البطاقات.
export default function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    // ظهور فوري إن كان العنصر ضمن الشاشة أصلاً وقت التركيب (فوق الطية) — لا ننتظر تمريراً
    if (el.getBoundingClientRect().top < window.innerHeight) { setShown(true); return undefined; }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { setShown(true); io.disconnect(); }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    );
    io.observe(el);
    // شبكة أمان: لو لم يُطلق المراقب لأي سبب (تبويب مخفي، حالة نادرة) نُظهر بعد مهلة
    // قصيرة — فلا يبقى المحتوى مخفياً إطلاقاً. تُلغى إن ظهر العنصر طبيعياً قبلها.
    const safety = setTimeout(() => setShown(true), 1500);
    return () => { io.disconnect(); clearTimeout(safety); };
  }, []);

  return (
    <div
      ref={ref}
      className={`bz-reveal ${shown ? 'bz-reveal-in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
