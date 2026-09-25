import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DeptIcon from './DeptIcon.jsx';
import { platformCatImage, platformCatKeys, catDept } from '../utils/platformCategories.js';

// تبويبات الأقسام (ملابس · أحذية · إكسسوارات) — تظهر فقط حين يجمع المكان أكثر
// من قسم؛ متجرٌ بقسمٍ واحد (وهو الأغلب) لا يرى شيئاً ويبقى كما كان.
//
// المؤشّر حبّةٌ واحدةٌ تنزلق بين التبويبات بدل تلوين الزرّ النشط وحده: الانتقال
// يُقرأ حركةً من مكانٍ إلى مكان، فيفهم الزائر أنّ المحتوى تحتها تبدّل لا الصفحة.
// موضعها يُقاس من الزرّ نفسه (offsetLeft/Width) فيصحّ بالعربية والإنجليزية
// وبأيّ طولٍ للاسم، ويُعاد قياسه حين يتغيّر العرض.
//
// صورة كلّ قسمٍ بأزراره ورؤوسه: من سلسلة رسوم الفئات نفسها (فستان، كعب، شنطة) لا
// أيقونةٌ خطّيّة — الأزرار كانت الشيء الوحيد بالصفحة بلغةٍ غير لغة الصور تحتها.
// من المصدر المشترك فتتبع صورةً يرفعها المدير لفئةٍ مدمجة.
const DEPT_CAT = { clothing: 'dress', shoes: 'heels', accessories: 'bags' };

export function DeptThumb({ dept, className = 'h-9 w-9' }) {
  const src = platformCatImage(DEPT_CAT[dept] || 'dress');
  return (
    <span className={`bz-dt-thumb grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`} aria-hidden="true">
      {src
        ? <img src={src} alt="" loading="eager" decoding="async" className="h-[86%] w-[86%] object-contain" />
        : <DeptIcon dept={dept} className="h-1/2 w-1/2" strokeWidth={1.6} />}
    </span>
  );
}

// رأس قسمٍ بصفحات التصنيفات حين تُعرض الأقسام كلّها متتالية: صورة القسم، واسمه،
// وخطٌّ يمتدّ إلى عدد قطعه — فاصلٌ يُقرأ من بعيد لا عنوانٌ ضائعٌ بين البطاقات.
export function DeptHeading({ dept, count = 0 }) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex items-center gap-3">
      <DeptThumb dept={dept} className="h-11 w-11 shadow-[0_6px_18px_-10px_rgba(0,0,0,0.5)]" />
      <h2 className="font-display text-xl font-bold text-wine">{t(`dept.${dept}`)}</h2>
      <span aria-hidden className="h-px flex-1 bg-wine/15" />
      {count > 0 && <span className="bz-dh-count shrink-0 text-xs font-semibold tabular-nums">{t('store.pieceCount', { count })}</span>}
    </div>
  );
}

// تبويبات الأقسام — شريطٌ بعرضٍ ثابت تتقاسمه الأقسام بالتساوي، بكلّ جهاز:
// الجوال: الصورة فوق الاسم (ثلاثة تتّسع لشاشة ٣٢٠ بكسلاً بلا تمرير ولا قصّ)،
// ومن الآيباد فما فوق: الصورة بجانب الاسم وعدد القطع.
export default function DeptTabs({ depts, value, onChange, counts = null, className = '' }) {
  const { t } = useTranslation();
  const wrap = useRef(null);
  const btns = useRef({});
  const [pill, setPill] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = btns.current[value];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, top: el.offsetTop, height: el.offsetHeight });
    };
    measure();
    if (typeof ResizeObserver === 'undefined' || !wrap.current) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, depts.length]);

  // رسوم فئات الأقسام الأخرى تُجلب بوقت الفراغ، قبل أن تُضغط تبويباتها: التبديل
  // يعرض شبكةً جاهزة بصورها لا بلاطاتٍ تنتظر الشبكة (والتخزين المسبق يكفي بعدها)
  const deptKey = (depts || []).join(',');
  useEffect(() => {
    if (!depts || depts.length < 2) return undefined;
    const run = () => {
      for (const k of platformCatKeys()) {
        if (!depts.includes(catDept(k))) continue;
        const src = platformCatImage(k);
        if (src) { const im = new Image(); im.decoding = 'async'; im.src = src; }
      }
    };
    const ric = window.requestIdleCallback;
    const id = ric ? ric(run, { timeout: 2500 }) : setTimeout(run, 900);
    return () => { if (ric && window.cancelIdleCallback) window.cancelIdleCallback(id); else clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptKey]);

  if (!depts || depts.length < 2) return null;

  return (
    <div className={`flex w-full justify-center ${className}`}>
      <div
        ref={wrap}
        role="tablist"
        aria-label={t('dept.tabsLabel')}
        className="bz-depttabs relative grid w-full max-w-[36rem] auto-cols-fr grid-flow-col gap-1 rounded-[1.6rem] p-1.5 sm:rounded-full"
      >
        {pill && (
          <span
            aria-hidden
            className="bz-dt-pill absolute rounded-[1.3rem] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.5)] sm:rounded-full"
            style={{
              left: pill.left, width: pill.width, top: pill.top, height: pill.height,
              transition: 'left 380ms cubic-bezier(0.22,0.61,0.36,1), width 380ms cubic-bezier(0.22,0.61,0.36,1)',
            }}
          />
        )}
        {depts.map((d) => {
          const on = d === value;
          return (
            <button
              key={d}
              ref={(el) => { btns.current[d] = el; }}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(d)}
              className="bz-dt-btn relative z-[1] flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.3rem] px-1 pb-2 pt-1.5 text-[12.5px] font-extrabold transition-colors duration-300 sm:flex-row sm:gap-2.5 sm:rounded-full sm:py-1.5 sm:pe-5 sm:ps-1.5 sm:text-sm"
            >
              <DeptThumb dept={d} className={`h-10 w-10 transition-transform duration-300 sm:h-9 sm:w-9 ${on ? 'scale-105' : ''}`} />
              <span className="max-w-full truncate">{t(`dept.${d}`)}</span>
              {counts && counts[d] > 0 && (
                <span className="bz-dt-count hidden rounded-full px-1.5 text-[10px] font-extrabold tabular-nums sm:inline">
                  {counts[d]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
