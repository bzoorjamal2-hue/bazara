import { useTranslation } from 'react-i18next';

// مقبضُ «اعرضها شريطاً عريضاً» لمجموعةٍ واحدة — مشتركٌ بينَ لوحةِ المديرِ
// ولوحةِ التاجرة، فما يصلُ أحدَهما يصلُ الآخرَ بالحركةِ نفسِها.
//
// عددُ الأشرطةِ بالصفحةِ هو عددُ ما يُعلَّمُ هنا — لا حقلَ عددٍ منفصل. الحقلُ
// المنفصلُ يفارقُ الواقعَ أوّلَ ما تُحذَفُ مجموعةٌ أو تُضاف، فيطلبُ الموقعُ
// شريطاً ثالثاً لا وجودَ له.
export default function CollectionWide({ c, onChange }) {
  const { t } = useTranslation();
  const on = Boolean(c.wide);
  // بلا صورةٍ لا يصلحُ شريطاً: الشريطُ صورةٌ بعرضِ الشاشةِ قبلَ كلِّ شيء.
  const ready = Boolean(c.image);

  return (
    <div className="mt-3 rounded-xl border border-gold-400/15 p-3">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-gold-400"
          checked={on}
          disabled={!ready}
          onChange={(e) => onChange({ wide: e.target.checked })}
        />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-stone-200">{t('dashboard.store.collWide')}</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-stone-400">
            {ready ? t('dashboard.store.collWideTip') : t('dashboard.store.collWideNeedsImage')}
          </span>
        </span>
      </label>

      {on && ready && (
        <div className="mt-3 space-y-3 border-t border-gold-400/10 pt-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-300" htmlFor={`coll-desc-${c.q}`}>
              {t('dashboard.store.collDesc')}
            </label>
            <input
              id={`coll-desc-${c.q}`}
              type="text"
              className="input"
              maxLength={160}
              placeholder={t('dashboard.store.collDescPlaceholder')}
              value={c.desc || ''}
              onChange={(e) => onChange({ desc: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-300" htmlFor={`coll-dim-${c.q}`}>
              {t('dashboard.store.bannerDim')}
              <span className="ms-2 font-mono text-[11px] text-stone-400" dir="ltr">{c.dim ?? 50}%</span>
            </label>
            <input
              id={`coll-dim-${c.q}`}
              type="range"
              min="0"
              max="90"
              step="5"
              dir="ltr"
              className="w-full accent-gold-400"
              value={c.dim ?? 50}
              onChange={(e) => onChange({ dim: Number(e.target.value) })}
              aria-label={t('dashboard.store.bannerDim')}
            />
            <div className="flex justify-between text-[10px] text-stone-400">
              <span>{t('dashboard.store.bannerDimLow')}</span>
              <span>{t('dashboard.store.bannerDimHigh')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
