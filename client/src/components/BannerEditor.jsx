import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ImageInput from './ImageInput.jsx';
import VideoInput from './VideoInput.jsx';
import { Field, RowTools } from './FormField.jsx';
import { ImageIcon, VideoIcon, PaletteIcon, SparkleIcon, LinkIcon } from './icons.jsx';
import { cldThumb, cldVideoPoster } from '../utils/cloudinary.js';

// أنواع خلفية الشريحة: [القيمة المخزّنة، مفتاح الترجمة، الأيقونة]
const BG_TYPES = [
  ['', 'bgTheme', SparkleIcon],
  ['color', 'bgColor', PaletteIcon],
  ['image', 'bgImage', ImageIcon],
  ['video', 'bgVideo', VideoIcon],
];
const MAX_BANNERS = 5;
// ألوان جاهزة من هوية بازارا + درجات محايدة — أسرع وأجمل من انتقاء لون عشوائي
const COLOR_PRESETS = ['#5e4636', '#3f2e22', '#6e2637', '#4a1322', '#1e1710', '#b8932c', '#d4af37', '#2f4f4f'];

// معاينة مصغّرة للشريحة كما تظهر بالسلايدر فعلاً: نفس الخلفية ونفس التعتيم
// ونفس ترتيب النص — فيرى المالك أثر كل تعديل فوراً بلا فتح المتجر.
function SlidePreview({ banner, storeName }) {
  const { t } = useTranslation();
  const { bgType, bgValue } = banner;
  const isColor = bgType === 'color' && bgValue;
  const isImage = bgType === 'image' && bgValue;
  const isVideo = bgType === 'video' && bgValue;
  // الصورة/الفيديو يُعتَّمان (brightness .6 بالسلايدر) — نحاكيها بتدرّج داكن فوق الصورة
  const media = isImage ? cldThumb(bgValue, 800) : isVideo ? cldThumb(cldVideoPoster(bgValue), 800) : '';
  const style = isColor
    ? { background: bgValue }
    : media
      ? { background: `linear-gradient(rgba(15,10,7,0.45), rgba(15,10,7,0.45)), url("${media}") center/cover` }
      : { background: 'linear-gradient(135deg, #4a1322 0%, #3f2e22 55%, #241712 100%)' };

  return (
    <div className="relative flex h-28 flex-col items-center justify-center overflow-hidden rounded-xl px-4 text-center sm:h-32" style={style}>
      {/* زخرفة الشريحة الافتراضية — نفس روح الشريحة الثابتة بالمتجر */}
      {!isColor && !media && (
        <>
          <span className="pointer-events-none absolute -top-8 start-[18%] h-20 w-20 rounded-full bg-gold-400/25 blur-2xl" />
          <span className="pointer-events-none absolute -bottom-8 end-[12%] h-24 w-24 rounded-full bg-cream/10 blur-2xl" />
        </>
      )}
      {/* شارة «شريحة فيديو»: قرص زجاجي بمثلّث تشغيل متمركز بصرياً — بدل الرمز
          النصّي ▶ الذي كان يختلف شكله بين الأجهزة ويبدو غير مرتّب */}
      {isVideo && (
        <span
          title={t('dashboard.store.bgVideo')} aria-label={t('dashboard.store.bgVideo')}
          className="absolute top-2 end-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-cream shadow-sm ring-1 ring-white/25 backdrop-blur-sm"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3 translate-x-[0.5px]" fill="currentColor" aria-hidden="true">
            <path d="M9 7.2v9.6a1 1 0 0 0 1.53.85l7.7-4.8a1 1 0 0 0 0-1.7l-7.7-4.8A1 1 0 0 0 9 7.2Z" />
          </svg>
        </span>
      )}
      <p className="relative line-clamp-2 font-display text-base font-extrabold text-cream drop-shadow sm:text-lg">
        {banner.title?.trim() || storeName || t('dashboard.store.bannerTitlePreview')}
      </p>
      {banner.subtitle?.trim() && <p className="relative mt-1 line-clamp-1 text-[11px] text-cream/85 drop-shadow">{banner.subtitle}</p>}
      {banner.btnLabel?.trim() && (
        <span className="relative mt-2 rounded-full bg-cream px-3 py-1 text-[10px] font-bold text-wine">{banner.btnLabel}</span>
      )}
    </div>
  );
}

// محرّر شرايح السلايدر — مشترك بين إعدادات المتجر وتحكّم المدير بالصفحة الرئيسية.
export default function BannerEditor({ banners = [], onChange, withButtons = false, storeName = '' }) {
  const { t } = useTranslation();
  const listRef = useRef(null);
  const justAdded = useRef(false); // بعد الإضافة: ننزل للشريحة الجديدة ونركّز أول حقل فيها
  const setBanner = (idx, key, val) => onChange(banners.map((b, i) => (i === idx ? { ...b, [key]: val } : b)));
  const addBanner = () => { justAdded.current = true; onChange([...banners, { title: '', subtitle: '', bgType: '', bgValue: '' }]); };

  // عند إضافة شريحة: ننزل إليها بسلاسة ونركّز أول حقل ليكتب المالك بياناته فوراً
  useEffect(() => {
    if (!justAdded.current) return;
    justAdded.current = false;
    const cards = listRef.current?.children;
    const last = cards && cards[cards.length - 1];
    if (last) {
      last.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => last.querySelector('input, textarea')?.focus({ preventScroll: true }), 300);
    }
  }, [banners.length]);

  const removeBanner = (idx) => onChange(banners.filter((_, i) => i !== idx));
  const setBannerBg = (idx, bgType) => onChange(banners.map((b, i) => (i === idx ? { ...b, bgType, bgValue: '' } : b)));
  // نسخ شريحة: أسرع طريقة لعمل شريحة مشابهة (نفس الخلفية والتنسيق) وتغيير نصّها فقط
  const duplicateBanner = (idx) => {
    if (banners.length >= MAX_BANNERS) return;
    const copy = { ...banners[idx] };
    onChange([...banners.slice(0, idx + 1), copy, ...banners.slice(idx + 1)]);
  };
  // ترتيب العرض بالسلايدر = ترتيب القائمة هنا — سهم لأعلى/لأسفل يبدّل مع الجارة
  const moveBanner = (idx, dir) => {
    const to = idx + dir;
    if (to < 0 || to >= banners.length) return;
    const next = [...banners];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-stone-400">
          {t('dashboard.store.slidesCount', { n: banners.length, max: MAX_BANNERS })}
        </p>
        {banners.length < MAX_BANNERS && (
          <button type="button" onClick={addBanner} className="btn-ghost !py-1.5 text-sm">＋ {t('dashboard.store.addBanner')}</button>
        )}
      </div>

      {banners.length === 0 ? (
        <button
          type="button" onClick={addBanner}
          className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed border-gold-400/25 bg-black/15 p-5 text-center transition hover:border-gold-400/50 hover:bg-gold-400/5"
        >
          <ImageIcon className="h-6 w-6 text-gold-300" />
          <span className="text-xs text-stone-400">{t('dashboard.store.noBanners')}</span>
        </button>
      ) : (
        <div ref={listRef} className="space-y-3">
          {banners.map((b, idx) => (
            /* بلا overflow-hidden: المعاينة تقصّ زواياها بنفسها، ووجوده كان يقصّ
               نوافذ التلميح «؟» الخارجة عن حدّ البطاقة */
            <div key={idx} className="rounded-2xl border border-gold-400/15 bg-black/20">
              {/* المعاينة الحيّة أعلى البطاقة */}
              <div className="p-2.5 pb-0">
                <SlidePreview banner={b} storeName={storeName} />
              </div>

              <div className="p-2.5">
                {/* الرأس: رقم الشريحة + أدوات الترتيب والنسخ والحذف */}
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/10 px-2.5 py-1 text-[11px] font-bold text-gold-200">
                    {t('dashboard.store.slide')} {idx + 1}
                  </span>
                  <RowTools
                    index={idx}
                    count={banners.length}
                    onMove={(dir) => moveBanner(idx, dir)}
                    onDuplicate={() => duplicateBanner(idx)}
                    canDuplicate={banners.length < MAX_BANNERS}
                    onRemove={() => removeBanner(idx)}
                  />
                </div>

                <div className="space-y-2.5">
                  <Field label={t('dashboard.store.bannerTitleLabel')} tip={t('dashboard.store.bannerTitleTip')} max={80} value={b.title || ''}>
                    <input
                      type="text"
                      className="input"
                      placeholder={t('dashboard.store.bannerTitle')}
                      value={b.title}
                      maxLength={80}
                      onChange={(e) => setBanner(idx, 'title', e.target.value)}
                    />
                  </Field>
                  <Field label={t('dashboard.store.bannerSubtitleLabel')} tip={t('dashboard.store.bannerSubtitleTip')} max={160} value={b.subtitle || ''}>
                    <input
                      type="text"
                      className="input"
                      placeholder={t('dashboard.store.bannerSubtitle')}
                      value={b.subtitle}
                      maxLength={160}
                      onChange={(e) => setBanner(idx, 'subtitle', e.target.value)}
                    />
                  </Field>
                </div>

                {/* خلفية الشريحة: افتراضي / لون / صورة / فيديو */}
                <div className="mt-3 border-t border-gold-400/10 pt-3">
                  <Field label={t('dashboard.store.bannerBg')} tip={t('dashboard.store.bannerBgTip')}>
                    <div className="grid grid-cols-4 gap-1.5">
                      {BG_TYPES.map(([val, key, Icon]) => {
                        const on = (b.bgType || '') === val;
                        return (
                          <button
                            type="button"
                            key={key}
                            onClick={() => setBannerBg(idx, val)}
                            className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold transition ${
                              on ? 'border-[#e4d8c5] bg-[#e4d8c5] text-[#2b1d12]' : 'border-white/15 bg-white/5 text-stone-300 hover:bg-white/10'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="truncate">{t(`dashboard.store.${key}`)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  {b.bgType === 'color' && (
                    <div className="mt-2.5">
                      {/* ألوان جاهزة من هوية المتجر + منتقي حرّ للحالات الخاصة */}
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {COLOR_PRESETS.map((c) => (
                          <button
                            key={c} type="button" onClick={() => setBanner(idx, 'bgValue', c)}
                            aria-label={c} title={c}
                            className={`h-7 w-7 rounded-full border-2 transition ${(b.bgValue || '').toLowerCase() === c ? 'border-[#e4d8c5] scale-110' : 'border-white/20 hover:scale-105'}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" className="h-9 w-12 cursor-pointer rounded-lg border border-gold-400/20 bg-black/30" value={b.bgValue || '#5e4636'} onChange={(e) => setBanner(idx, 'bgValue', e.target.value)} />
                        <span className="text-xs text-stone-400" dir="ltr">{b.bgValue || '#5e4636'}</span>
                      </div>
                    </div>
                  )}
                  {b.bgType === 'image' && (
                    <div className="mt-2.5"><ImageInput value={b.bgValue} onChange={(v) => setBanner(idx, 'bgValue', v)} hint={t('dashboard.store.bannerImageHint')} /></div>
                  )}
                  {b.bgType === 'video' && (
                    <div className="mt-2.5"><VideoInput value={b.bgValue} onChange={(v) => setBanner(idx, 'bgValue', v)} hint={t('dashboard.store.bannerVideoHint')} /></div>
                  )}
                </div>

                {/* زر الشريحة (للمدير) — نص + وجهة عند الضغط */}
                {withButtons && (
                  <div className="mt-3 space-y-2.5 border-t border-gold-400/10 pt-3">
                    <Field label={t('dashboard.store.slideButton')} tip={t('dashboard.store.slideButtonTip')} max={40} value={b.btnLabel || ''}>
                      <input
                        type="text"
                        className="input"
                        placeholder={t('dashboard.store.btnLabel')}
                        value={b.btnLabel || ''}
                        maxLength={40}
                        onChange={(e) => setBanner(idx, 'btnLabel', e.target.value)}
                      />
                    </Field>
                    <Field label={t('dashboard.store.btnHrefLabel')} icon={<LinkIcon className="h-4 w-4" />} tip={t('dashboard.store.btnHrefHint')} hint={t('dashboard.store.btnHrefHint')}>
                      <input
                        type="text"
                        dir="ltr"
                        className="input"
                        placeholder={t('dashboard.store.btnHref')}
                        value={b.btnHref || ''}
                        maxLength={500}
                        onChange={(e) => setBanner(idx, 'btnHref', e.target.value)}
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
