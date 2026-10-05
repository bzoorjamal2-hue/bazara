import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cldVideoMp4, cldVideoPoster } from '../../../utils/cloudinary.js';
import { HeartIcon, SendIcon, ReplyIcon } from '../../../components/icons.jsx';

// معاينةُ الإعلانِ كما يراه الناس — بكلِّ مكانٍ يظهرُ فيه. ما يُكتَبُ بخانةٍ يختلفُ
// شكلُه بين خلاصةِ فيسبوك وستوري إنستغرام: النصُّ يُقصُّ بعدَ سطرين هنا ويختفي كلُّه
// هناك، والعنوانُ يظهرُ تحتَ الصورةِ بفيسبوك ولا يظهرُ بالستوري. فترى التاجرةُ ذلك
// قبلَ أن تدفع، لا بعدَه.

const VIEWS = ['fb_feed', 'ig_feed', 'ig_story', 'ig_reels'];
const CTA = { sales: 'shop', traffic: 'shop', messages: 'message', awareness: 'more' };

// نسبةُ الوسيطةِ بالخلاصة: الصورةُ بمقاسِها المختار، والفيديو الطوليُّ يُقصُّ ٤:٥
// (أطولُ ما تعرضُه الخلاصتان).
const FEED_ASPECT = { square: 'aspect-square', wide: 'aspect-[1.91/1]', story: 'aspect-[4/5]' };

function Media({ format, image, video, className }) {
  if (format === 'video' && video) {
    return <video src={cldVideoMp4(video, 720)} poster={cldVideoPoster(video, 720) || undefined} muted autoPlay loop playsInline className={`${className} object-cover`} />;
  }
  return image
    ? <img src={image} alt="" className={`${className} object-cover`} />
    : <div className={`${className} bg-stone-700`} />;
}

// بالستوري والريلز: صورةٌ غيرُ طوليّةٍ لا تملأُ الشاشة — ميتا تضعُها بالوسطِ فوقَ نسخةٍ
// مغبَّشةٍ منها. نعرضُها كذلك كي ترى التاجرةُ لماذا يُنصَحُ بمقاسِ الستوري.
function FullMedia({ format, image, video, size }) {
  if (format === 'video' || size === 'story') {
    return <Media format={format} image={image} video={video} className="absolute inset-0 h-full w-full" />;
  }
  return (
    <>
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl" />}
      <div className="absolute inset-0 flex items-center">
        <Media format="image" image={image} className={`w-full ${FEED_ASPECT[size] || 'aspect-square'}`} />
      </div>
    </>
  );
}

function Avatar({ logo, name, size = 'h-8 w-8' }) {
  return logo
    ? <img src={logo} alt="" className={`${size} shrink-0 rounded-full object-cover ring-1 ring-black/10`} />
    : <span className={`${size} grid shrink-0 place-items-center rounded-full bg-[#7a2540] text-xs font-bold text-white`}>{(name || 'B').slice(0, 1)}</span>;
}

// ما يُرى قبلَ «المزيد» — تقريباً ما يقصُّه فيسبوك (١٢٥ حرفاً) وإنستغرام (سطران)
const clip = (s, n) => {
  const v = String(s || '').trim();
  return v.length > n ? { text: `${v.slice(0, n).trim()}…`, more: true } : { text: v, more: false };
};

export default function AdPreview({ goal, format, size = 'square', image, video, copy, store, domain }) {
  const { t } = useTranslation();
  const [view, setView] = useState('ig_feed');
  const cta = t(`adStudio.pv.cta.${CTA[goal] || 'shop'}`);
  const name = store?.name || 'Bazara';
  const feedAspect = format === 'video' ? 'aspect-[4/5]' : (FEED_ASPECT[size] || 'aspect-square');
  const handle = (store?.slug || 'bazara').replace(/[^a-z0-9._]/gi, '').toLowerCase() || 'bazara';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label={t('adStudio.pv.title')}>
        {VIEWS.map((v) => (
          <button
            key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`rounded-xl border px-1.5 py-2 text-[10px] font-bold leading-tight transition ${
              view === v ? 'border-[#999795] bg-[#999795] text-[#313130]' : 'border-gold-400/25 text-stone-300 hover:bg-gold-400/10'
            }`}
          >
            {t(`adStudio.pv.v.${v}`)}
          </button>
        ))}
      </div>

      <div className="flex justify-center rounded-2xl bg-[#0f0f0e] p-3">
        {/* الإطارُ بالإنجليزيّةِ أو العربيّةِ حسبَ لغةِ اللوحة؛ والمحتوى بلغةِ الإعلان */}
        {view === 'fb_feed' && (
          <div className="w-full max-w-[340px] overflow-hidden rounded-xl bg-white text-[#050505]" dir="rtl">
            <div className="flex items-center gap-2 p-3">
              <Avatar logo={store?.logo} name={name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">{name}</p>
                <p className="text-[11px] text-[#65676b]">{t('adStudio.pv.sponsored')} · 🌐</p>
              </div>
            </div>
            <p className="whitespace-pre-wrap px-3 pb-2 text-[13px] leading-snug">
              {clip(copy?.primary, 125).text}
              {clip(copy?.primary, 125).more && <span className="font-semibold text-[#65676b]"> {t('adStudio.pv.more')}</span>}
            </p>
            <Media format={format} image={image} video={video} className={`${feedAspect} w-full`} />
            <div className="flex items-center gap-2 bg-[#f0f2f5] px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] uppercase text-[#65676b]" dir="ltr">{domain}</p>
                <p className="truncate text-[14px] font-bold">{copy?.headline}</p>
              </div>
              <span className="shrink-0 rounded-md bg-[#e4e6eb] px-3 py-2 text-[13px] font-semibold">{cta}</span>
            </div>
          </div>
        )}

        {view === 'ig_feed' && (
          <div className="w-full max-w-[340px] overflow-hidden rounded-xl bg-white text-[#000]" dir="rtl">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <Avatar logo={store?.logo} name={name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold" dir="ltr">{handle}</p>
                <p className="text-[11px] text-[#737373]">{t('adStudio.pv.sponsored')}</p>
              </div>
              <span className="text-lg leading-none text-[#737373]">⋯</span>
            </div>
            <Media format={format} image={image} video={video} className={`${feedAspect} w-full`} />
            <div className="flex items-center justify-between bg-[#3797f0] px-3 py-2.5 text-[13px] font-semibold text-white">
              <span>{cta}</span><span aria-hidden="true">‹</span>
            </div>
            <div className="flex items-center gap-3 px-3 pt-2.5 text-[#262626]">
              <HeartIcon className="h-5 w-5" /><ReplyIcon className="h-5 w-5" /><SendIcon className="h-5 w-5" />
            </div>
            <p className="px-3 pb-3 pt-1.5 text-[13px] leading-snug">
              <span className="font-semibold" dir="ltr">{handle}</span>{' '}
              {clip(copy?.primary, 90).text}
              {clip(copy?.primary, 90).more && <span className="text-[#737373]"> {t('adStudio.pv.more')}</span>}
            </p>
          </div>
        )}

        {(view === 'ig_story' || view === 'ig_reels') && (
          <div className="relative aspect-[9/16] w-full max-w-[250px] overflow-hidden rounded-2xl bg-black text-white">
            <FullMedia format={format} image={image} video={video} size={size} />
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3">
              {view === 'ig_story' && <div className="mb-2 h-0.5 rounded bg-white/40"><div className="h-full w-1/3 rounded bg-white" /></div>}
              <div className="flex items-center gap-2" dir="rtl">
                <Avatar logo={store?.logo} name={name} size="h-7 w-7" />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold" dir="ltr">{handle}</p>
                  <p className="text-[10px] text-white/80">{t('adStudio.pv.sponsored')}</p>
                </div>
              </div>
            </div>
            {view === 'ig_reels' && (
              <div className="absolute bottom-20 end-2 flex flex-col items-center gap-3">
                <HeartIcon className="h-6 w-6" /><ReplyIcon className="h-6 w-6" /><SendIcon className="h-6 w-6" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10" dir="rtl">
              {view === 'ig_reels' && (
                <p className="mb-2 line-clamp-2 pe-8 text-[12px] leading-snug">{copy?.primary}</p>
              )}
              <div className="mx-auto flex w-fit flex-col items-center gap-1">
                <span aria-hidden="true" className="text-xs leading-none">︿</span>
                <span className="rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-black">{cta}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="text-center text-[11px] leading-relaxed text-stone-500">{t(`adStudio.pv.note.${view}`)}</p>
    </div>
  );
}
