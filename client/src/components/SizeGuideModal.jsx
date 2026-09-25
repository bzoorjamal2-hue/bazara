import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import useScrollLock from '../hooks/useScrollLock.js';
import CloseButton from './CloseButton.jsx';
import { CheckIcon, SparkleIcon, RulerIcon } from './icons.jsx';
import { SIZE_CHART, SHOE_CHART, sizeLabel } from '../utils/sizes.js';

// جذرُ الثيم: النوافذُ المرسومةُ على body لا تصلُها قواعدُ الوضعِ الليليّ
const bzPortalRoot = () => (typeof document !== 'undefined' && (document.querySelector('.theme-pub') || document.body)) || null;

// نافذة دليل المقاسات — جدول قياسات (صدر/خصر/أرداف) + مرشد "اعرفي مقاسك".
// chart: دليل المتجر المخصّص (إن وُجد) يطغى على الجدول القياسي. تعرض نمر المنتج فقط.
// dept='shoes': جدول نمر الأحذية بطول القدم، والمرشد يأخذ طول القدم لا الصدر.
export default function SizeGuideModal({ sizes = [], chart = null, dept = 'clothing', onClose }) {
  if (dept === 'shoes') return <ShoeGuide sizes={sizes} onClose={onClose} />;
  return <ClothingGuide sizes={sizes} chart={chart} onClose={onClose} />;
}

function ClothingGuide({ sizes = [], chart = null, onClose }) {
  const { t } = useTranslation();
  useScrollLock(true);
  const [bust, setBust] = useState('');
  const [waist, setWaist] = useState('');
  const [suggested, setSuggested] = useState('');

  // النمر الرقمية المتوفّرة بهذا المنتج فقط (نستبعد "ون سايز")
  const rows = sizes.filter((s) => s !== 'one' && SIZE_CHART[s]);
  const onlyOneSize = rows.length === 0;

  // قياسات كل نمرة: دليل المتجر المخصّص إن توفّر وإلا القياسي
  const measFor = (s) => {
    const c = chart && chart[s];
    if (c && (c.bust || c.waist || c.hips)) return { ...SIZE_CHART[s], ...c };
    return SIZE_CHART[s];
  };

  // اقتراح المقاس: الأقرب لمحيط الصدر المُدخل (وعند التساوي نرجّح الخصر)
  const suggest = () => {
    const b = Number(bust);
    if (!b) { setSuggested('__err'); return; }
    const w = Number(waist) || null;
    let best = null, bestScore = Infinity;
    for (const s of rows) {
      const m = measFor(s);
      const score = Math.abs(m.bust - b) + (w ? Math.abs(m.waist - w) * 0.5 : 0);
      if (score < bestScore) { bestScore = score; best = s; }
    }
    setSuggested(best || '');
  };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 animate-fade-up" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet relative max-h-[88vh] w-full max-w-lg overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        {/* الرأس */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-wine">
            <RulerGlyph /> {t('product.sizeGuide')}
          </h3>
          <CloseButton onClick={onClose} variant="wine" />
        </div>

        <p className="mb-4 text-sm text-wine/70">{t('product.sizeGuideIntro')}</p>

        {onlyOneSize ? (
          <p className="rounded-2xl bg-wine/5 px-4 py-5 text-center text-sm font-medium text-wine">
            {t('product.sizeGuideOneSize')}
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-wine/10">
              <table className="w-full table-fixed border-collapse text-center text-[clamp(0.72rem,3.4vw,0.875rem)]">
                <thead>
                  <tr className="bg-wine text-cream">
                    <th className="w-[28%] px-1.5 py-2.5 font-semibold">{t('product.sizeCol')}</th>
                    <th className="px-1 py-2.5 font-semibold">{t('product.bustCol')}</th>
                    <th className="px-1 py-2.5 font-semibold">{t('product.waistCol')}</th>
                    <th className="px-1 py-2.5 font-semibold">{t('product.hipsCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => {
                    const m = measFor(s);
                    const isSug = suggested === s;
                    return (
                      <tr key={s} className={isSug ? 'bg-emerald-500/15' : i % 2 ? 'bg-wine/[0.04]' : 'bg-white'}>
                        <td className="px-1.5 py-2.5 font-bold text-wine">
                          {isSug && <CheckIcon className="me-0.5 inline h-3.5 w-3.5" />}
                          {sizeLabel(s, t)}<span className="text-[0.85em] font-medium text-wine/50"> · {SIZE_CHART[s].intl}</span>
                        </td>
                        <td className="px-1 py-2.5 text-[#2b2b2b]">{m.bust || '—'}</td>
                        <td className="px-1 py-2.5 text-[#2b2b2b]">{m.waist || '—'}</td>
                        <td className="px-1 py-2.5 text-[#2b2b2b]">{m.hips || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* اعرفي مقاسك — مرشد سريع */}
            <div className="mt-4 rounded-2xl border border-wine/15 bg-wine/[0.04] p-4">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-wine"><SparkleIcon className="h-4 w-4" /> {t('product.findMySize')}</p>
              <p className="mb-3 text-xs text-wine/60">{t('product.findMySizeHint')}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block min-w-0 text-xs font-medium text-wine/70">
                  {t('product.yourBust')}
                  <input dir="ltr" inputMode="numeric" value={bust} onChange={(e) => setBust(e.target.value.replace(/\D/g, ''))} className="input mt-1 w-full !py-2 text-center" placeholder="cm" />
                </label>
                <label className="block min-w-0 text-xs font-medium text-wine/70">
                  {t('product.yourWaist')}
                  <input dir="ltr" inputMode="numeric" value={waist} onChange={(e) => setWaist(e.target.value.replace(/\D/g, ''))} className="input mt-1 w-full !py-2 text-center" placeholder="cm" />
                </label>
              </div>
              <button type="button" onClick={suggest} className="mt-2 w-full rounded-xl bg-wine py-2.5 text-sm font-bold text-cream transition hover:bg-wine-dark">
                {t('product.suggestSize')}
              </button>
              {suggested === '__err' ? (
                <p className="mt-2 text-sm font-medium text-red-500">{t('product.suggestEnter')}</p>
              ) : suggested ? (
                <p className="mt-3 rounded-xl bg-emerald-500/15 px-3 py-2 text-center text-sm font-bold text-emerald-600">
                  {t('product.suggestedSize', { size: sizeLabel(suggested, t) })}
                </p>
              ) : null}
            </div>

            {/* كيف تقيسين؟ */}
            <div className="mt-4 rounded-2xl bg-wine/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-wine"><RulerIcon className="h-4 w-4" /> {t('product.howMeasure')}</p>
              <ul className="space-y-1 text-sm text-wine/70">
                <li>• {t('product.measureBust')}</li>
                <li>• {t('product.measureWaist')}</li>
                <li>• {t('product.measureHips')}</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>,
    bzPortalRoot()
  );
}

// دليل نمر الأحذية: نمرةٌ أوروبيّة ← طول القدم بالسنتيمتر. المرشد يقترح أصغر
// نمرةٍ لا يقلّ طولها عن القدم: الحذاء الضيّق يُرجَع، والواسع قليلاً يُلبَس.
function ShoeGuide({ sizes = [], onClose }) {
  const { t } = useTranslation();
  useScrollLock(true);
  const [foot, setFoot] = useState('');
  const [suggested, setSuggested] = useState('');
  const rows = sizes.filter((s) => SHOE_CHART[s] != null).sort((a, b) => Number(a) - Number(b));

  const suggest = () => {
    const f = Number(String(foot).replace(',', '.'));
    if (!f || f < 15 || f > 35) { setSuggested('__err'); return; }
    const fit = rows.find((s) => SHOE_CHART[s] >= f);
    setSuggested(fit || (rows.length ? '__big' : ''));
  };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 animate-fade-up" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet relative max-h-[88vh] w-full max-w-lg overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-wine">
            <RulerGlyph /> {t('product.shoeGuide')}
          </h3>
          <CloseButton onClick={onClose} variant="wine" />
        </div>
        <p className="mb-4 text-sm text-wine/70">{t('product.shoeGuideIntro')}</p>

        {rows.length === 0 ? (
          <p className="rounded-2xl bg-wine/5 px-4 py-5 text-center text-sm font-medium text-wine">{t('product.sizeGuideOneSize')}</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-wine/10">
              <table className="w-full table-fixed border-collapse text-center text-[clamp(0.78rem,3.4vw,0.9rem)]">
                <thead>
                  <tr className="bg-wine text-cream">
                    <th className="px-2 py-2.5 font-semibold">{t('product.shoeSizeCol')}</th>
                    <th className="px-2 py-2.5 font-semibold">{t('product.footLengthCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => {
                    const isSug = suggested === s;
                    return (
                      <tr key={s} className={isSug ? 'bg-emerald-500/15' : i % 2 ? 'bg-wine/[0.04]' : 'bg-white'}>
                        <td className="px-2 py-2.5 font-bold text-wine">
                          {isSug && <CheckIcon className="me-0.5 inline h-3.5 w-3.5" />}
                          {s}
                        </td>
                        <td className="px-2 py-2.5 text-[#2b2b2b]" dir="ltr">{SHOE_CHART[s]} cm</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* اعرفي نمرتك — بطول القدم */}
            <div className="mt-4 rounded-2xl border border-wine/15 bg-wine/[0.04] p-4">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-wine"><SparkleIcon className="h-4 w-4" /> {t('product.findMyShoeSize')}</p>
              <p className="mb-3 text-xs text-wine/60">{t('product.findMyShoeSizeHint')}</p>
              <label className="block text-xs font-medium text-wine/70">
                {t('product.yourFootLength')}
                <input dir="ltr" inputMode="decimal" value={foot} onChange={(e) => setFoot(e.target.value.replace(/[^\d.,]/g, ''))} className="input mt-1 w-full !py-2 text-center" placeholder="24.5 cm" />
              </label>
              <button type="button" onClick={suggest} className="mt-2 w-full rounded-xl bg-wine py-2.5 text-sm font-bold text-cream transition hover:bg-wine-dark">
                {t('product.suggestSize')}
              </button>
              {suggested === '__err' ? (
                <p className="mt-2 text-sm font-medium text-red-500">{t('product.enterFootLength')}</p>
              ) : suggested === '__big' ? (
                <p className="mt-2 text-sm font-medium text-wine/80">{t('product.footTooLong')}</p>
              ) : suggested ? (
                <p className="mt-3 rounded-xl bg-emerald-500/15 px-3 py-2 text-center text-sm font-bold text-emerald-600">
                  {t('product.suggestedSize', { size: suggested })}
                </p>
              ) : null}
            </div>

            {/* كيف تقيسين قدمك؟ */}
            <div className="mt-4 rounded-2xl bg-wine/5 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-wine"><RulerIcon className="h-4 w-4" /> {t('product.howMeasureFoot')}</p>
              <ul className="space-y-1 text-sm text-wine/70">
                <li>• {t('product.measureFoot1')}</li>
                <li>• {t('product.measureFoot2')}</li>
                <li>• {t('product.measureFoot3')}</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>,
    bzPortalRoot()
  );
}

// مسطرة أنيقة
function RulerGlyph({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="8" width="19" height="8" rx="1.6" />
      <path d="M7 8v3M12 8v4M17 8v3" />
    </svg>
  );
}
