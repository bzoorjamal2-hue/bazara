import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import useScrollLock from '../hooks/useScrollLock.js';
import { SIZE_CHART, sizeLabel } from '../utils/sizes.js';

// نافذة دليل المقاسات — جدول قياسات نسائي قياسي (صدر/خصر/أرداف) بالسنتيمتر.
// تعرض فقط النمر المتوفّرة للمنتج. تطابق هوية بازارا وتعمل بالوضعين والاتجاهين.
export default function SizeGuideModal({ sizes = [], onClose }) {
  const { t } = useTranslation();
  useScrollLock(true);

  // النمر الرقمية المتوفّرة بهذا المنتج فقط (نستبعد "ون سايز")
  const rows = sizes.filter((s) => s !== 'one' && SIZE_CHART[s]);
  const onlyOneSize = rows.length === 0;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 animate-fade-up" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        {/* الرأس */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-wine">
            <RulerGlyph /> {t('product.sizeGuide')}
          </h3>
          <button
            onClick={onClose}
            aria-label="close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-wine/10 text-lg text-wine transition hover:bg-wine hover:text-cream"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-wine/70">{t('product.sizeGuideIntro')}</p>

        {onlyOneSize ? (
          <p className="rounded-2xl bg-wine/5 px-4 py-5 text-center text-sm font-medium text-wine">
            {t('product.sizeGuideOneSize')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-wine/10">
            <table className="w-full border-collapse text-center text-sm">
              <thead>
                <tr className="bg-wine text-cream">
                  <th className="px-2 py-2.5 font-semibold">{t('product.sizeCol')}</th>
                  <th className="px-2 py-2.5 font-semibold">{t('product.bustCol')}</th>
                  <th className="px-2 py-2.5 font-semibold">{t('product.waistCol')}</th>
                  <th className="px-2 py-2.5 font-semibold">{t('product.hipsCol')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const m = SIZE_CHART[s];
                  return (
                    <tr key={s} className={i % 2 ? 'bg-wine/[0.04]' : 'bg-white'}>
                      <td className="px-2 py-2.5 font-bold text-wine">
                        {sizeLabel(s, t)} <span className="text-xs font-medium text-wine/50">· {m.intl}</span>
                      </td>
                      <td className="px-2 py-2.5 text-[#2b2b2b]">{m.bust}</td>
                      <td className="px-2 py-2.5 text-[#2b2b2b]">{m.waist}</td>
                      <td className="px-2 py-2.5 text-[#2b2b2b]">{m.hips}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* كيف تقيسين؟ */}
        {!onlyOneSize && (
          <div className="mt-4 rounded-2xl bg-wine/5 p-4">
            <p className="mb-2 text-sm font-bold text-wine">📐 {t('product.howMeasure')}</p>
            <ul className="space-y-1 text-sm text-wine/70">
              <li>• {t('product.measureBust')}</li>
              <li>• {t('product.measureWaist')}</li>
              <li>• {t('product.measureHips')}</li>
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// مسطرة أنيقة
function RulerGlyph({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="8" width="19" height="8" rx="1.6" transform="rotate(0 12 12)" />
      <path d="M7 8v3M12 8v4M17 8v3" />
    </svg>
  );
}
