import { useState } from 'react';
import { colorToCss } from '../utils/colorDot.js';
import { cldThumb } from '../utils/cloudinary.js';

// اللون منفد كلياً: موجود في مخزون الألوان وكل كمياته صفر
const isSoldOut = (stock, c) => {
  const sizes = stock?.[c];
  if (!sizes || typeof sizes !== 'object') return false;
  const vals = Object.values(sizes);
  return vals.length > 0 && vals.every((q) => q === 0);
};

// اختيار اللون بأسلوب المتاجر العالمية (Zara/ASOS): مربّع swatch يعرض صورة المنتج
// بذاك اللون إن وُجدت، وإلا دائرة/مربّع بلون CSS الفعلي. المختار بحلقة بفراغ،
// والمنفد بخط قطري معطّل. الاسم يظهر مرّة واحدة فوق ويتحدّث مع المرور/الاختيار.
export default function ColorSwatches({
  colors = [], colorImages = {}, colorStock = {}, value = '', onChange, label, tone = 'dark',
}) {
  const [hover, setHover] = useState('');
  if (!colors.length) return null;
  const display = hover || value;
  const headingCls = tone === 'dark' ? 'text-stone-300' : 'text-stone-700';
  const nameCls = tone === 'dark' ? 'text-cream/60' : 'text-stone-500';

  return (
    <div>
      <p className={`mb-2 text-sm font-semibold ${headingCls}`}>
        {label}
        {display ? <span className={`font-normal ${nameCls}`}>: {display}</span> : null}
      </p>
      <div className="flex flex-wrap gap-2.5" onMouseLeave={() => setHover('')}>
        {colors.map((c) => {
          const raw = Array.isArray(colorImages[c]) ? colorImages[c].find(Boolean) : null;
          const img = raw ? cldThumb(raw, 120) : null;
          const css = colorToCss(c);
          const on = value === c;
          const soldOut = isSoldOut(colorStock, c);
          return (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={c}
              aria-pressed={on}
              disabled={soldOut}
              onMouseEnter={() => setHover(c)}
              onFocus={() => setHover(c)}
              onClick={() => onChange?.(on ? '' : c)}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl transition ${
                on ? 'outline outline-2 outline-wine outline-offset-2' : ''
              } ${soldOut ? 'cursor-not-allowed opacity-45' : 'hover:opacity-90'}`}
            >
              {img ? (
                <img src={img} alt={c} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="block h-full w-full" style={{ background: css || '#d6d3d1' }} />
              )}
              {/* حافة داخلية رفيعة لتمييز الألوان الفاتحة عن الخلفية */}
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/10" />
              {/* خط قطري للّون المنفد */}
              {soldOut && (
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{ backgroundImage: 'linear-gradient(to top right, transparent calc(50% - 0.75px), rgba(80,80,80,0.85) 50%, transparent calc(50% + 0.75px))' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
