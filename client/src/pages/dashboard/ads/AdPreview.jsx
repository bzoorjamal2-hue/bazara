import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cldVideoMp4, cldVideoPoster } from '../../../utils/cloudinary.js';
import { LinkOutIcon, SendIcon } from '../../../components/icons.jsx';

// معاينةُ الإعلانِ على شاشةِ جوّالٍ حقيقيّة — بواجهةِ فيسبوك وإنستغرام كما هي، لا رسماً
// تقريبيّاً. ما يُكتَبُ بخانةٍ يختلفُ شكلُه بين الأماكن: النصُّ يُقصُّ بعدَ سطرين هنا ويختفي
// كلُّه هناك، والعنوانُ يظهرُ تحتَ الصورةِ بفيسبوك ولا يظهرُ بالستوري. فترى التاجرةُ ذلك
// قبلَ أن تدفع، ومعه أين تذهبُ الكبسةُ بالضبط.

const VIEWS = ['ig_feed', 'ig_story', 'ig_reels', 'fb_feed'];
const CTA = { sales: 'shop', traffic: 'shop', messages: 'message', awareness: 'more' };
const FEED_ASPECT = { square: 'aspect-square', wide: 'aspect-[1.91/1]', story: 'aspect-[4/5]' };
// خطُّ النظامِ نفسُه الذي تستعملُه تطبيقاتُ ميتا على كلِّ جهاز
const APP_FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Noto Sans Arabic", Tahoma, sans-serif' };

// ───────────────────── أيقوناتُ التطبيقين ─────────────────────
const I = ({ d, className = 'h-6 w-6', fill = 'none', sw = 1.9, children }) => (
  <svg viewBox="0 0 24 24" className={className} fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);
const Heart = (p) => <I {...p} d="M16.8 3.5c-1.9 0-3.6 1-4.8 2.6C10.8 4.5 9.1 3.5 7.2 3.5 4.3 3.5 2 5.9 2 8.9c0 5.6 8.6 11 10 11.6 1.4-.6 10-6 10-11.6 0-3-2.3-5.4-5.2-5.4Z" />;
const Comment = (p) => <I {...p} d="M20.6 16.3A9.5 9.5 0 1 0 17 20l4 1-0.4-4.7Z" />;
const Plane = (p) => <I {...p}><path d="M22 3 9.2 10.1" /><path d="M22 3 15.3 21l-6.1-10.9L2 6.4 22 3Z" /></I>;
const Bookmark = (p) => <I {...p} d="M19 21 12 15.5 5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17Z" />;
const Dots = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
);
const Chevron = (p) => <I {...p} d="m15 6-6 6 6 6" />; // يشيرُ لليسار: اتّجاهُ «التالي» بالعربيّة
const Close = (p) => <I {...p} d="M6 6l12 12M18 6 6 18" />;
const Globe = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z" /></I>;
const Like = (p) => <I {...p} d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Zm0 0 4-7c1.4 0 2.3 1.2 2 2.5L12.3 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" />;
const Share = (p) => <I {...p} d="M14 4l7 7-7 7v-4c-5 0-8.5 1.5-11 5 1-5 4-10 11-11V4Z" />;
const Music = (p) => <I {...p}><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></I>;

// ───────────────────── الوسيطة ─────────────────────
function Media({ format, image, video, className }) {
  if (format === 'video' && video) {
    return <video src={cldVideoMp4(video, 720)} poster={cldVideoPoster(video, 720) || undefined} muted autoPlay loop playsInline className={`${className} object-cover`} />;
  }
  return image
    ? <img src={image} alt="" className={`${className} object-cover`} />
    : <div className={`${className} bg-neutral-200`} />;
}

// ستوري وريلز: صورةٌ غيرُ طوليّةٍ لا تملأُ الشاشة — ميتا تضعُها بالوسطِ فوقَ نسخةٍ
// مغبَّشةٍ منها. نعرضُها كذلك كي ترى التاجرةُ لماذا يُنصَحُ بمقاسِ الستوري.
function FullMedia({ format, image, video, size }) {
  if (format === 'video' || size === 'story') {
    return <Media format={format} image={image} video={video} className="absolute inset-0 h-full w-full" />;
  }
  return (
    <>
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-80 blur-2xl" />}
      <div className="absolute inset-0 flex items-center">
        <Media format="image" image={image} className={`w-full ${FEED_ASPECT[size] || 'aspect-square'}`} />
      </div>
    </>
  );
}

function Avatar({ logo, name, size = 32, ring = false }) {
  const inner = logo
    ? <img src={logo} alt="" className="h-full w-full rounded-full object-cover" />
    : <span className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-[#7a2540] to-[#3d1220] font-bold text-white" style={{ fontSize: size * 0.42 }}>{(name || 'B').trim().slice(0, 1)}</span>;
  if (!ring) return <span className="block shrink-0" style={{ width: size, height: size }}>{inner}</span>;
  // حلقةُ الستوري الملوّنة حولَ الصورة — علامةُ حسابٍ نشِطٍ بإنستغرام
  return (
    <span className="block shrink-0 rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[2px]" style={{ width: size + 4, height: size + 4 }}>
      <span className="block h-full w-full rounded-full bg-white p-[1.5px]">{inner}</span>
    </span>
  );
}

// ما يُرى قبلَ «المزيد» — تقريباً ما يقصُّه فيسبوك (١٢٥ حرفاً) وإنستغرام (سطران)
const clip = (s, n) => {
  const v = String(s || '').trim().replace(/\s+/g, ' ');
  return v.length > n ? { text: `${v.slice(0, n).trim()}…`, more: true } : { text: v, more: false };
};

// ───────────────────── إطارُ الجوّال ─────────────────────
function Phone({ dark, children }) {
  return (
    <div className="bz-ad-phone relative mx-auto w-[300px] max-w-full rounded-[44px] bg-[#1a1a1a] p-[10px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45),inset_0_0_0_1.5px_#3a3a3a]">
      <div className={`relative h-[664px] overflow-hidden rounded-[34px] ${dark ? 'bg-black text-white' : 'bg-white text-[#0c0c0c]'}`} style={APP_FONT}>
        {/* شريطُ الحالة وجزيرةُ الكاميرا */}
        <div className={`absolute inset-x-0 top-0 z-30 flex h-11 items-center justify-between px-7 text-[13px] font-semibold ${dark ? 'text-white' : 'text-black'}`} dir="ltr">
          <span>9:41</span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 18 12" className="h-3 w-4" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" /><rect x="10" y="2.5" width="3" height="9.5" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
            <svg viewBox="0 0 26 12" className="h-3 w-6" aria-hidden="true"><rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.5" /><rect x="2" y="2" width="16" height="8" rx="1.8" fill="currentColor" /><rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.5" /></svg>
          </span>
        </div>
        <div className="absolute left-1/2 top-2.5 z-40 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
        {children}
        {/* شريطُ الرجوعِ أسفلَ الشاشة */}
        <div className={`absolute bottom-1.5 left-1/2 z-40 h-1 w-28 -translate-x-1/2 rounded-full ${dark ? 'bg-white/80' : 'bg-black/80'}`} />
      </div>
    </div>
  );
}

// زرُّ الإعلانِ بإنستغرام يبدأُ أبيضَ ثمّ يتلوّنُ بعد ثانيتين — هكذا يلفتُ النظرَ فعلاً
function useBloom(dep) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    const id = setTimeout(() => setOn(true), 1800);
    return () => clearTimeout(id);
  }, [dep]);
  return on;
}

// ───────────────────── المعاينة ─────────────────────
export default function AdPreview({ goal, format, size = 'square', image, video, copy, store, link, igHandle }) {
  const { t } = useTranslation();
  const [view, setView] = useState('ig_feed');
  const bloom = useBloom(`${view}:${goal}`);
  const cta = t(`adStudio.pv.cta.${CTA[goal] || 'shop'}`);
  const name = store?.name || 'Bazara';
  const handle = igHandle || (store?.slug || 'bazara').replace(/[^a-z0-9._]/gi, '').toLowerCase() || 'bazara';
  const domain = String(link || '').replace(/^https?:\/\//, '').split('/')[0];
  const feedAspect = format === 'video' ? 'aspect-[4/5]' : (FEED_ASPECT[size] || 'aspect-square');
  const isMsg = goal === 'messages';
  const caption = clip(copy?.primary, view === 'fb_feed' ? 110 : 58);

  return (
    <div className="space-y-4">
      <div className="bz-ad-seg mx-auto grid max-w-md grid-cols-4 gap-1 rounded-2xl p-1" role="tablist" aria-label={t('adStudio.pv.title')}>
        {VIEWS.map((v) => (
          <button
            key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`bz-ad-segbtn rounded-xl px-1.5 py-2 text-[12px] font-bold ${view === v ? 'is-on' : ''}`}
          >
            {t(`adStudio.pv.v.${v}`)}
          </button>
        ))}
      </div>

      <div className="bz-ad-stage rounded-3xl px-3 py-6">
        {/* ═══ خلاصةُ إنستغرام ═══ */}
        {view === 'ig_feed' && (
          <Phone>
            <div className="flex h-full flex-col pt-11" dir="rtl">
              <div className="flex h-11 shrink-0 items-center justify-between px-4">
                <span className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: '"Grand Hotel", "Snell Roundhand", "Brush Script MT", cursive' }} dir="ltr">Instagram</span>
                <span className="flex items-center gap-4"><Heart className="h-6 w-6" /><Plane className="h-6 w-6" /></span>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <Avatar logo={store?.logo} name={name} size={32} ring />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-[13px] font-semibold" dir="ltr" style={{ textAlign: 'right' }}>{handle}</p>
                    <p className="text-[11px] text-neutral-500">{t('adStudio.pv.sponsored')}</p>
                  </div>
                  <Dots className="h-5 w-5" />
                </div>
                <Media format={format} image={image} video={video} className={`${feedAspect} w-full`} />
                <div className={`flex items-center justify-between border-b border-neutral-200 px-3.5 py-2.5 text-[13px] font-semibold transition-colors duration-500 ${bloom ? 'bg-[#0095f6] text-white' : 'bg-white text-[#0c0c0c]'}`}>
                  <span>{cta}</span><Chevron className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-3.5 px-3 pt-2.5">
                  <Heart className="h-[25px] w-[25px]" /><Comment className="h-[24px] w-[24px]" /><Plane className="h-[24px] w-[24px]" />
                  <span className="flex-1" />
                  <Bookmark className="h-6 w-6" />
                </div>
                <p className="px-3 pt-2 text-[13px] leading-[18px]">
                  <span className="font-semibold" dir="ltr">{handle}</span>{' '}
                  {caption.text}
                  {caption.more && <span className="text-neutral-500"> {t('adStudio.pv.more')}</span>}
                </p>
              </div>
              <TabBar />
            </div>
          </Phone>
        )}

        {/* ═══ ستوري إنستغرام ═══ */}
        {view === 'ig_story' && (
          <Phone dark>
            <FullMedia format={format} image={image} video={video} size={size} />
            <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 via-black/20 to-transparent px-2.5 pb-10 pt-12" dir="rtl">
              <div className="flex gap-1" dir="ltr">
                <span className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/35"><span className="block h-full w-2/5 rounded-full bg-white" /></span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <Avatar logo={store?.logo} name={name} size={30} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[13px] font-semibold" dir="ltr" style={{ textAlign: 'right' }}>{handle}</p>
                  <p className="text-[11px] text-white/80">{t('adStudio.pv.sponsored')}</p>
                </div>
                <Dots className="h-5 w-5" /><Close className="h-6 w-6" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center bg-gradient-to-t from-black/60 to-transparent px-4 pb-9 pt-16">
              <svg viewBox="0 0 24 24" className="mb-1 h-5 w-5 animate-bounce text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold shadow-lg transition-colors duration-500 ${bloom ? 'bg-white text-black' : 'bg-white/90 text-black'}`}>
                {isMsg ? <SendIcon className="h-4 w-4" /> : <LinkOutIcon className="h-4 w-4" />} {cta}
              </span>
            </div>
          </Phone>
        )}

        {/* ═══ ريلز إنستغرام ═══ */}
        {view === 'ig_reels' && (
          <Phone dark>
            <FullMedia format={format} image={image} video={video} size={size} />
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent px-4 pb-6 pt-12" dir="rtl">
              <span className="text-[19px] font-bold">{t('adStudio.pv.reels')}</span>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><rect x="3" y="6" width="14" height="13" rx="3" /><path d="M17 10.5 21 8v9l-4-2.5" /></svg>
            </div>
            <div className="absolute bottom-24 end-3 z-20 flex flex-col items-center gap-4 text-[11px] font-semibold" dir="rtl">
              <span className="flex flex-col items-center gap-1"><Heart className="h-7 w-7" />2,481</span>
              <span className="flex flex-col items-center gap-1"><Comment className="h-7 w-7" />96</span>
              <span className="flex flex-col items-center gap-1"><Plane className="h-7 w-7" />310</span>
              <Dots className="h-6 w-6" />
              <span className="h-7 w-7 overflow-hidden rounded-lg ring-2 ring-white"><Avatar logo={store?.logo} name={name} size={28} /></span>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3.5 pb-8 pt-24" dir="rtl">
              <div className="flex items-center gap-2 pe-12">
                <Avatar logo={store?.logo} name={name} size={30} />
                <p className="min-w-0 truncate text-[13px] font-semibold" dir="ltr">{handle}</p>
                <span className="text-[11px] text-white/75">· {t('adStudio.pv.sponsored')}</span>
              </div>
              <p className="mt-2 pe-12 text-[13px] leading-[18px] text-white/95">
                {clip(copy?.primary, 55).text}
                {clip(copy?.primary, 55).more && <span className="text-white/60"> {t('adStudio.pv.more')}</span>}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 pe-12 text-[11px] text-white/80"><Music className="h-3.5 w-3.5" /> {t('adStudio.pv.audio')}</p>
              <div className={`mt-3 flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition-colors duration-500 ${bloom ? 'bg-[#0095f6] text-white' : 'bg-white/20 text-white backdrop-blur'}`}>
                <span>{cta}</span><Chevron className="h-4 w-4" />
              </div>
            </div>
          </Phone>
        )}

        {/* ═══ خلاصةُ فيسبوك ═══ */}
        {view === 'fb_feed' && (
          <Phone>
            <div className="flex h-full flex-col bg-[#e9ebee] pt-11" dir="rtl">
              <div className="flex h-11 shrink-0 items-center justify-between bg-white px-3.5">
                <span className="text-[26px] font-bold tracking-tight text-[#0866ff]" dir="ltr" style={{ fontFamily: 'Helvetica, Arial, sans-serif', letterSpacing: '-0.04em' }}>facebook</span>
                <span className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e4e6eb]"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e4e6eb]"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg></span>
                </span>
              </div>
              <div className="mt-2 min-h-0 flex-1 overflow-hidden bg-white">
                <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
                  <Avatar logo={store?.logo} name={name} size={40} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-[14px] font-semibold">{name}</p>
                    <p className="flex items-center gap-1 text-[12px] text-[#65676b]">{t('adStudio.pv.sponsored')} · <Globe className="h-3 w-3" sw={2} /></p>
                  </div>
                  <span className="flex items-center gap-2 text-[#65676b]"><Dots className="h-5 w-5" /><Close className="h-5 w-5" /></span>
                </div>
                <p className="px-3 pb-2.5 text-[14px] leading-[19px]">
                  {caption.text}
                  {caption.more && <span className="font-semibold text-[#65676b]"> {t('adStudio.pv.seeMore')}</span>}
                </p>
                <Media format={format} image={image} video={video} className={`${feedAspect} w-full`} />
                <div className="flex items-center gap-3 bg-[#f0f2f5] px-3 py-2.5">
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-[11px] uppercase tracking-wide text-[#65676b]" dir="ltr" style={{ textAlign: 'right' }}>{isMsg ? 'MESSENGER' : domain}</p>
                    <p className="mt-0.5 truncate text-[15px] font-semibold">{copy?.headline}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#e2e5e9] px-3 py-2 text-[13px] font-semibold">
                    {isMsg && <SendIcon className="h-4 w-4" />}{cta}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-[12px] text-[#65676b]">
                  <span className="flex items-center gap-1">
                    <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#0866ff] text-white"><Like className="h-2.5 w-2.5" sw={2.6} /></span>
                    <span className="-ms-1.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-[#f33e58] text-white ring-2 ring-white"><Heart className="h-2.5 w-2.5" fill="currentColor" sw={0} /></span>
                    <span className="ms-1">184</span>
                  </span>
                  <span>{t('adStudio.pv.fbCounts')}</span>
                </div>
                <div className="mx-3 flex items-center justify-around border-t border-[#e4e6eb] py-1.5 text-[13px] font-semibold text-[#65676b]">
                  <span className="flex items-center gap-1.5"><Like className="h-5 w-5" /> {t('adStudio.pv.fbLike')}</span>
                  <span className="flex items-center gap-1.5"><Comment className="h-5 w-5" /> {t('adStudio.pv.fbComment')}</span>
                  <span className="flex items-center gap-1.5"><Share className="h-5 w-5" /> {t('adStudio.pv.fbShare')}</span>
                </div>
              </div>
            </div>
          </Phone>
        )}
      </div>

      {/* أين تذهبُ الكبسة — الجوابُ الذي تسألُ عنه كلُّ تاجرةٍ قبلَ أن تدفع */}
      <div className="bz-ad-soft flex items-start gap-3 rounded-2xl p-3.5">
        <span className="bz-ad-goal-ico grid h-9 w-9 shrink-0 place-items-center rounded-xl">
          {isMsg ? <SendIcon className="h-4 w-4" /> : <LinkOutIcon className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold">{t(isMsg ? 'adStudio.pv.goesDm' : 'adStudio.pv.goesPage')}</p>
          <p className="bz-ad-muted mt-0.5 truncate text-[11px]" dir="ltr" style={{ textAlign: 'right' }}>
            {isMsg ? `instagram.com/${handle}` : String(link || '').replace(/^https?:\/\//, '')}
          </p>
          <p className="bz-ad-muted mt-1 text-[11.5px] leading-relaxed">{t(`adStudio.pv.note.${view}`)}</p>
        </div>
      </div>
    </div>
  );
}

// شريطُ إنستغرام السفليّ — ما تراه الزبونةُ تحتَ كلِّ منشور
function TabBar() {
  return (
    <div className="flex h-12 shrink-0 items-center justify-around border-t border-neutral-200 bg-white pb-2 text-[#0c0c0c]">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M12 3 3 10v10a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1V10l-9-7Z" /></svg>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 8v8M8 12h8" /></svg>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M3 8h18M9 3l3 5M15 3l3 5M10 12v5l4-2.5-4-2.5Z" /></svg>
      <span className="h-6 w-6 rounded-full bg-neutral-300" />
    </div>
  );
}
