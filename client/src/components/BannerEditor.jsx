import { useTranslation } from 'react-i18next';
import ImageInput from './ImageInput.jsx';
import VideoInput from './VideoInput.jsx';

const BG_TYPES = [['', 'bgTheme'], ['color', 'bgColor'], ['image', 'bgImage'], ['video', 'bgVideo']];
const MAX_BANNERS = 5;

// محرّر شرايح السلايدر — مشترك بين إعدادات المتجر وتحكّم المدير بالصفحة الرئيسية.
export default function BannerEditor({ banners = [], onChange }) {
  const { t } = useTranslation();
  const setBanner = (idx, key, val) => onChange(banners.map((b, i) => (i === idx ? { ...b, [key]: val } : b)));
  const addBanner = () => onChange([...banners, { title: '', subtitle: '', bgType: '', bgValue: '' }]);
  const removeBanner = (idx) => onChange(banners.filter((_, i) => i !== idx));
  const setBannerBg = (idx, bgType) => onChange(banners.map((b, i) => (i === idx ? { ...b, bgType, bgValue: '' } : b)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-400">{t('dashboard.store.bannersHint')}</p>
        {banners.length < MAX_BANNERS && (
          <button type="button" onClick={addBanner} className="btn-ghost !py-1.5 text-sm">＋ {t('dashboard.store.addBanner')}</button>
        )}
      </div>

      {banners.length === 0 ? (
        <p className="rounded-xl border border-gold-400/15 bg-black/20 p-4 text-center text-sm text-stone-400">{t('dashboard.store.noBanners')}</p>
      ) : (
        <div className="space-y-3">
          {banners.map((b, idx) => (
            <div key={idx} className="rounded-xl border border-gold-400/15 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gold-200">{t('dashboard.store.slide')} {idx + 1}</span>
                <button type="button" onClick={() => removeBanner(idx)} className="text-xs text-red-300 hover:text-red-200">🗑 {t('common.delete')}</button>
              </div>
              <input
                type="text"
                className="input mb-2"
                placeholder={t('dashboard.store.bannerTitle')}
                value={b.title}
                maxLength={80}
                onChange={(e) => setBanner(idx, 'title', e.target.value)}
              />
              <input
                type="text"
                className="input"
                placeholder={t('dashboard.store.bannerSubtitle')}
                value={b.subtitle}
                maxLength={160}
                onChange={(e) => setBanner(idx, 'subtitle', e.target.value)}
              />

              {/* خلفية الشريحة: افتراضي / لون / صورة / فيديو */}
              <div className="mt-3 border-t border-gold-400/10 pt-3">
                <p className="mb-2 text-xs font-semibold text-stone-300">{t('dashboard.store.bannerBg')}</p>
                <div className="flex flex-wrap gap-2">
                  {BG_TYPES.map(([val, key]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setBannerBg(idx, val)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        (b.bgType || '') === val ? 'border-gold-400 bg-gold-400/20 text-gold-100' : 'border-gold-400/20 text-stone-300 hover:bg-white/5'
                      }`}
                    >
                      {t(`dashboard.store.${key}`)}
                    </button>
                  ))}
                </div>

                {b.bgType === 'color' && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="color" className="h-9 w-12 cursor-pointer rounded-lg border border-gold-400/20 bg-black/30" value={b.bgValue || '#5e4636'} onChange={(e) => setBanner(idx, 'bgValue', e.target.value)} />
                    <span className="text-xs text-stone-400" dir="ltr">{b.bgValue || '#5e4636'}</span>
                  </div>
                )}
                {b.bgType === 'image' && (
                  <div className="mt-2"><ImageInput value={b.bgValue} onChange={(v) => setBanner(idx, 'bgValue', v)} /></div>
                )}
                {b.bgType === 'video' && (
                  <div className="mt-2"><VideoInput value={b.bgValue} onChange={(v) => setBanner(idx, 'bgValue', v)} /></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
