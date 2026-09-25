import { useEffect, useRef, useState } from 'react';

// شطب سعر مضبوط بمنتصف الأرقام بصريّاً على كل جهاز وخطّ.
//
// لماذا لا نكتفي بـ CSS (‎top:50%‎)؟ لأن رمز العملة ₪ قد لا يكون ضمن خط Inter
// المُجزّأ المُحمَّل على iOS، فيسقط على خط النظام (أطول)، فيتضخّم صندوق السطر
// لأعلى وتنزل الأرقام لأسفله — فيصبح منتصف الصندوق فوق الأرقام (الخط يبان بالأعلى).
// الحل: نقيس الـbaseline الحقيقي على الجهاز نفسه، ونضع الخط عند مركز حبر الأرقام
// تماماً مهما تضخّم الصندوق. قبل اكتمال القياس نرجع لـ‎50%‎ (قريبٌ جدّاً).
//
// القياسُ دفعةٌ واحدةٌ بعد أوّلِ رسمٍ لا بطاقةً بطاقةً قبله. كان كلُّ سعرٍ مشطوبٍ يقيسُ
// نفسَه بـuseLayoutEffect — يُدخلُ عنصراً ويقرأُ المقاسَ ويحذفُه — فصفحةٌ فيها عشرون
// بطاقةً تُجبِرُ المتصفّحَ على عشرينَ إعادةِ تخطيطٍ قبلَ أن تظهر: كانت أثقلَ ما يُحسَبُ
// عند فتحِ «الرئيسية» من الشريطِ السفليّ. الآن تظهرُ الصفحةُ أوّلاً، ثمّ بإطارٍ واحدٍ:
// قراءةُ الأنماطِ كلِّها، ثمّ كتابةُ العلاماتِ كلِّها، ثمّ قراءةُ المواضعِ كلِّها (تخطيطٌ
// واحد)، ثمّ حذفُها. والأسعارُ بالخطِّ نفسِه لها الموضعُ نفسُه — تُقاسُ مرّة.
const cache = new Map();
const queue = new Map(); // عنصر ← دالّة تضبط الموضع
let frame = 0;
let ctx2d = null;

function flush() {
  frame = 0;
  const jobs = [...queue].filter(([el]) => el.isConnected);
  queue.clear();
  // ١) قراءة: الأنماطُ والمفاتيح
  const need = [];
  for (const [el, set] of jobs) {
    const cs = getComputedStyle(el);
    const raw = (el.textContent || '').trim();
    const key = `${cs.fontWeight}|${cs.fontSize}|${cs.lineHeight}|${cs.fontFamily}|${raw.replace(/[0-9.,\s]/g, '')}`;
    if (cache.has(key)) set(cache.get(key));
    else need.push({ el, set, key, cs, raw });
  }
  if (!need.length) return;
  // ٢) كتابة: علامةُ الـbaseline بكلِّ عنصرٍ يحتاجُ قياساً (مفتاحٌ واحدٌ يكفيه عنصرٌ واحد)
  const first = new Map();
  for (const n of need) if (!first.has(n.key)) first.set(n.key, n);
  const probes = [...first.values()];
  for (const n of probes) {
    n.marker = document.createElement('span');
    n.marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    n.el.appendChild(n.marker);
  }
  // ٣) قراءة: تخطيطٌ واحدٌ للجميع
  for (const n of probes) {
    const box = n.el.getBoundingClientRect();
    n.h = box.height;
    n.base = n.marker.getBoundingClientRect().top - box.top;
  }
  // ٤) كتابة: حذفُ العلامات وحسابُ مركزِ حبرِ الأرقام
  ctx2d ||= document.createElement('canvas').getContext('2d');
  for (const n of probes) {
    n.marker.remove();
    if (!n.h) continue;
    ctx2d.font = `${n.cs.fontWeight} ${n.cs.fontSize}/${n.cs.lineHeight} ${n.cs.fontFamily}`;
    const digits = n.raw.replace(/[^0-9]/g, '');
    const m = ctx2d.measureText(digits || n.raw || '0');
    cache.set(n.key, n.base - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  }
  for (const n of need) if (cache.has(n.key)) n.set(cache.get(n.key));
}

function schedule(el, set) {
  queue.set(el, set);
  if (!frame) frame = requestAnimationFrame(flush);
}

// الخطوطُ تصلُ بعد الرسم: يتغيّرُ الخطُّ الفعليّ، فيُعادُ القياسُ مرّةً للجميع
const live = new Map();
if (typeof document !== 'undefined' && document.fonts?.ready) {
  document.fonts.ready.then(() => {
    cache.clear();
    for (const [el, set] of live) schedule(el, set);
  }).catch(() => {});
  // مقاسُ الخطِّ متجاوبٌ مع عرضِ الشاشة: تدويرُ الجوّالِ يغيّرُه
  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { for (const [el, set] of live) schedule(el, set); }, 150);
  });
}

export default function Strike({ children, className = '', ...rest }) {
  const ref = useRef(null);
  const [y, setY] = useState(null); // px من أعلى الصندوق لمركز الشطب

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    live.set(el, setY);
    schedule(el, setY);
    return () => { live.delete(el); queue.delete(el); };
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
