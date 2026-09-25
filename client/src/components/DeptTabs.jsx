import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DeptIcon from './DeptIcon.jsx';

// تبويبات الأقسام (ملابس · أحذية · إكسسوارات) — تظهر فقط حين يجمع المكان أكثر
// من قسم؛ متجرٌ بقسمٍ واحد (وهو الأغلب) لا يرى شيئاً ويبقى كما كان.
//
// المؤشّر حبّةٌ واحدةٌ تنزلق بين التبويبات بدل تلوين الزرّ النشط وحده: الانتقال
// يُقرأ حركةً من مكانٍ إلى مكان، فيفهم الزائر أنّ المحتوى تحتها تبدّل لا الصفحة.
// موضعها يُقاس من الزرّ نفسه (offsetLeft/Width) فيصحّ بالعربية والإنجليزية
// وبأيّ طولٍ للاسم، ويُعاد قياسه حين يتغيّر العرض.
// رأس قسمٍ بصفحات التصنيفات حين تُعرض الأقسام كلّها متتالية: دائرةٌ بأيقونته،
// واسمه، وخطٌّ يمتدّ إلى عدد قطعه — فاصلٌ يُقرأ من بعيد لا عنوانٌ ضائعٌ بين البطاقات.
export function DeptHeading({ dept, count = 0 }) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="bz-dh-dot flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-[0_6px_18px_-10px_rgba(0,0,0,0.5)]">
        <DeptIcon dept={dept} className="h-5 w-5" strokeWidth={1.7} />
      </span>
      <h2 className="font-display text-xl font-bold text-wine">{t(`dept.${dept}`)}</h2>
      <span aria-hidden className="h-px flex-1 bg-wine/15" />
      {count > 0 && <span className="bz-dh-count shrink-0 text-xs font-semibold tabular-nums">{t('store.pieceCount', { count })}</span>}
    </div>
  );
}

export default function DeptTabs({ depts, value, onChange, counts = null, className = '' }) {
  const { t } = useTranslation();
  const wrap = useRef(null);
  const btns = useRef({});
  const [pill, setPill] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = btns.current[value];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    if (typeof ResizeObserver === 'undefined' || !wrap.current) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, depts.length]);

  if (!depts || depts.length < 2) return null;

  return (
    <div className={`flex justify-center ${className}`}>
      <div
        ref={wrap}
        role="tablist"
        aria-label={t('dept.tabsLabel')}
        className="bz-depttabs relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pill && (
          <span
            aria-hidden
            className="bz-dt-pill absolute inset-y-1 rounded-full shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)]"
            style={{ left: pill.left, width: pill.width, transition: 'left 380ms cubic-bezier(0.22,0.61,0.36,1), width 380ms cubic-bezier(0.22,0.61,0.36,1)' }}
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
              className="bz-dt-btn relative z-[1] flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition-colors duration-300 sm:gap-2 sm:px-5"
            >
              <DeptIcon dept={d} className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} />
              <span className="whitespace-nowrap">{t(`dept.${d}`)}</span>
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
