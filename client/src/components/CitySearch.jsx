import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PinIcon } from './icons.jsx';

// خانة بحث عن المدينة: تكتب فتفلتر كل المدن (بالاسم أو المنطقة) ويظهر سعر التوصيل لكل مدينة؛
// اختيارها يملأ الأجرة. لا تُغلق عند فقدان التركيز (كي لا تختفي عند التمرير/إخفاء الكيبورد على
// الموبايل) — تُغلق فقط عند الضغط خارجها، تماماً مثل مكوّن Select.
// onText (اختياري): يسمح بكتابة قيمة حرّة غير موجودة بالقائمة (لخانة القرية/المنطقة —
// قد تكون قرية صغيرة ما إلها ذكر بالقائمة، فما منوقّف الزبونة عند حدّ القائمة).
export default function CitySearch({ value, onPick, onClear, onText, options, invalid, placeholder }) {
  const { t } = useTranslation();
  const [q, setQ] = useState(value || '');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => { setQ(value || ''); }, [value]);

  // الإغلاق عند الضغط خارج المكوّن فقط (وليس عند blur) — يبقى مفتوحاً أثناء تمرير القائمة
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const term = q.trim().toLowerCase();
  const results = (term
    ? options.filter((z) => `${z.name || ''} ${z.region || ''}`.toLowerCase().includes(term))
    : options).slice(0, 60);
  // نمرّر العنصر كاملاً كوسيط ثالث — خانة المدينة تستعمله لتعرف مدينة القرية المختارة
  const pick = (z) => { onPick(z.name, z.fee, z); setQ(z.name); setOpen(false); };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          className={`input !rounded-2xl pe-9 ${invalid ? 'ring-1 ring-red-400/70' : ''}`}
          placeholder={placeholder || t('co.selectCity')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (onText) onText(e.target.value);
            else if (value && onClear) onClear();
          }}
          onFocus={() => setOpen(true)}
        />
        <PinIcon className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wine/50" />
      </div>
      {open && results.length > 0 && (
        <ul
          className="animate-pop absolute z-[60] mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-2xl border border-wine/15 bg-white p-1.5 shadow-2xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.map((z) => (
            <li key={`${z.name}|${z.region || ''}`}>
              <button
                type="button"
                onClick={() => pick(z)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-wine/5"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-[#2b2b2b]">{z.name}</span>
                  {z.region ? <span className="block text-[11px] text-stone-400">{z.region}</span> : null}
                </span>
                {z.fee ? <span className="shrink-0 font-semibold text-wine">{t('common.currency')}{z.fee}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
