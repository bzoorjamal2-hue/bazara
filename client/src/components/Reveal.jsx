import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// ظهور تدريجي عند دخول العنصر للشاشة (fade + slide up) — لمسة فخامة حديثة.
// خفيف: IntersectionObserver واحد لكل عنصر، يُفصل فور الظهور (مرّة واحدة، بلا تكلفة
// مستمرة). يحترم تفضيل تقليل الحركة تلقائياً عبر CSS. delay اختياري لتتابع البطاقات.
export default function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  // ما كان على الشاشةِ لحظةَ فتحِ الصفحةِ يُرسَمُ حاضراً بلا حركة: كان يُرسَمُ مخفيّاً ثمّ
  // يظهرُ بتلاشٍ ٤٠٠ms بعدَ أوّلِ رسمة — فكلُّ تبويبٍ تفتحينه «يصلُ» ببطءٍ بدل أن يكونَ هناك.
  // ‏useLayoutEffect يقرّرُ قبلَ أوّلِ رسمٍ على الشاشة، فلا ومضةَ ولا حركة.
  const [now, setNow] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.getBoundingClientRect().top < window.innerHeight) { setNow(true); setShown(true); }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    if (el.getBoundingClientRect().top < window.innerHeight) { setShown(true); return undefined; }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { setShown(true); io.disconnect(); }
      },
      // يبدأ قبل الوصول (كالبطاقات): القسم جاهزٌ حين يبلغه التمرير
      { rootMargin: '0px 0px 25% 0px', threshold: 0 },
    );
    io.observe(el);
    // شبكة أمان: لو لم يُطلق المراقب لأي سبب (تبويب مخفي، حالة نادرة) نُظهر بعد مهلة
    // قصيرة — فلا يبقى المحتوى مخفياً إطلاقاً. تُلغى إن ظهر العنصر طبيعياً قبلها.
    const safety = setTimeout(() => setShown(true), 1500);
    return () => { io.disconnect(); clearTimeout(safety); };
  }, []);

  // بعد انتهاء حركة الدخول نُسقط will-change: إبقاؤها على كل الأقسام يحجز طبقات
  // رسم دائمة تستنزف ذاكرة وحدة الرسم وتُقطّع التمرير على الأجهزة الضعيفة.
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!shown) return undefined;
    const id = setTimeout(() => setDone(true), 500);
    return () => clearTimeout(id);
  }, [shown]);

  return (
    <div
      ref={ref}
      className={`bz-reveal ${shown ? 'bz-reveal-in' : ''} ${done || now ? 'bz-reveal-done' : ''} ${className}`}
      style={now ? { transition: 'none' } : delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
