import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cldThumb } from '../utils/cloudinary.js';

// وضعُ نقاطِ «اشتري الإطلالة» على الصورة: تُختارُ القطعةُ ثمّ يُضغَطُ موضعُها
// من الصورة. بلا هذه الشاشةِ تبقى الميزةُ نظريّةً — لا سبيلَ لإدخالِ إحداثيّة.
//
// النسبةُ المئويّةُ لا البكسل: الصورةُ تُعرَضُ بمقاساتٍ مختلفةٍ بين لوحةِ
// التحكّمِ والجوّالِ والشاشةِ العريضة، والبكسلُ يضيعُ معناه بينها.
export default function LookbookPoints({ lb, onChange }) {
  const { t } = useTranslation();
  const boxRef = useRef(null);
  const ids = Array.isArray(lb.productIds) ? lb.productIds : [];
  const points = Array.isArray(lb.points) ? lb.points : [];

  if (!lb.image || ids.length === 0) {
    return (
      <p className="mt-2 rounded-lg border border-gold-400/20 px-3 py-2 text-[11px] leading-relaxed text-stone-400">
        {t('admin.lookPointsNeed')}
      </p>
    );
  }

  const place = (e) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100);
    const y = Math.round(((e.clientY - r.top) / r.height) * 100);
    // القطعةُ التالية بلا موضعٍ بعد — فالضغطاتُ المتتاليةُ تملأُ القائمةَ بالترتيب
    const next = ids.find((id) => !points.some((p) => p.id === id));
    if (!next) return;
    onChange({ ...lb, points: [...points, { id: next, x, y }] });
  };

  const clearOne = (id) => onChange({ ...lb, points: points.filter((p) => p.id !== id) });
  const placed = points.length;
  const remaining = ids.length - placed;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-stone-300">
        {t('admin.lookPoints')}
        <span className="ms-2 font-normal text-stone-400">
          {remaining > 0 ? t('admin.lookPointsLeft', { n: remaining }) : t('admin.lookPointsDone')}
        </span>
      </p>
      <div
        ref={boxRef}
        onClick={place}
        role="presentation"
        className="relative max-w-[320px] cursor-crosshair overflow-hidden rounded-xl ring-1 ring-gold-400/20"
      >
        <img src={cldThumb(lb.image, 640)} alt="" className="block w-full" />
        {points.map((p, n) => (
          <button
            key={p.id}
            type="button"
            onClick={(e) => { e.stopPropagation(); clearOne(p.id); }}
            title={t('admin.lookPointRemove')}
            className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#FAF9F7] text-[11px] font-bold text-[#1F1E1D] shadow-md"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            {n + 1}
          </button>
        ))}
      </div>
      {placed > 0 && (
        <button
          type="button"
          onClick={() => onChange({ ...lb, points: [] })}
          className="text-[11px] font-semibold text-stone-400 transition hover:text-red-300"
        >
          {t('admin.lookPointsClear')}
        </button>
      )}
    </div>
  );
}
