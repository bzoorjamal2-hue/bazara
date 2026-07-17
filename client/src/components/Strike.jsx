import { useLayoutEffect, useRef, useState } from 'react';

// شطب سعر مضبوط بمنتصف الأرقام بصريّاً على كل جهاز وخطّ.
//
// لماذا لا نكتفي بـ CSS (‎top:50%‎)؟ لأن رمز العملة ₪ قد لا يكون ضمن خط Inter
// المُجزّأ المُحمَّل على iOS، فيسقط على خط النظام (أطول)، فيتضخّم صندوق السطر
// لأعلى وتنزل الأرقام لأسفله — فيصبح منتصف الصندوق فوق الأرقام (الخط يبان بالأعلى).
// الحل: نقيس الـbaseline الحقيقي على الجهاز نفسه وقت العرض، ونضع الخط عند مركز
// حبر الأرقام تماماً مهما تضخّم الصندوق. قبل اكتمال القياس نرجع لـ‎50%‎ (قريب).
export default function Strike({ children, className = '', ...rest }) {
  const ref = useRef(null);
  const [y, setY] = useState(null); // px من أعلى الصندوق لمركز الشطب

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      if (!el.isConnected) return;
      // ماركر baseline: عنصر inline صفر الأبعاد محاذاته baseline → حافته العليا = البيسلاين
      const marker = document.createElement('span');
      marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      el.appendChild(marker);
      const box = el.getBoundingClientRect();
      const baselineFromTop = marker.getBoundingClientRect().top - box.top;
      el.removeChild(marker);
      if (!box.height) return;

      // مركز حبر الأرقام فوق البيسلاين عبر canvas بنفس خط العنصر
      const cs = getComputedStyle(el);
      const ctx = (compute.ctx ||= document.createElement('canvas').getContext('2d'));
      ctx.font = `${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
      const raw = (el.textContent || '').trim();
      const digits = raw.replace(/[^0-9]/g, '');
      const m = ctx.measureText(digits || raw || '0');
      const inkCenterAbove = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;

      setY(baselineFromTop - inkCenterAbove);
    };

    compute();
    // أعد الحساب عند تحميل الخطوط أو تغيّر المقاس
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    if (document.fonts?.ready) document.fonts.ready.then(compute).catch(() => {});
    return () => ro.disconnect();
  }, [children]);

  return (
    <span
      ref={ref}
      className={`strike ${className}`}
      style={y != null ? { '--strike-y': `${y}px` } : undefined}
      {...rest}
    >
      {children}
    </span>
  );
}
