import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cldThumb } from '../utils/cloudinary.js';
import { usePublicCatKeys, platformCatImage, platformCatImageFallback, catImage, catDept, platformCatName } from '../utils/platformCategories.js';
import CatIcon from './CatIcon.jsx';

// لا قائمةَ مكتوبةً هنا: الاحتياطيّ يُبنى من مفاتيح المنصّة الحيّة، وإلا لم تظهر
// الفئة التي يضيفها المدير في أي شبكةٍ لم تُمرَّر إليها cats صراحةً.

// عدد البطاقات المعروضة حسب عرض الشاشة (جوال 2 · آيباد 3 · كمبيوتر 5)
function getPerPage() {
  if (typeof window === 'undefined') return 5;
  const w = window.innerWidth;
  if (w < 640) return 2;
  if (w < 1024) return 3;
  // بعد توسيع حاوية الموقع صارت البلاطة ~320px على الشاشات العريضة — سادسة تعيد التناسب
  if (w < 1536) return 5;
  // الصفحة تمتدّ حتى ٢٤٠٠: البلاطة تبقى بحجمها (~٣٠٠) والصفّ يكسب بلاطات
  if (w < 2000) return 6;
  if (w < 2400) return 7;
  return 8;
}

// بطاقة فئة عصرية: صورة (صورة المالكة الحقيقية إن وُجدت، وإلا أيقونة) بزوايا دائرية
// ناعمة بلا إطار بنّي، والاسم بالأسفل مباشرة. تدعم الفئات الأصلية والمخصّصة.
function CategoryCard({ cat }) {
  const { t, i18n } = useTranslation();
  const label = cat.name || (cat.builtin ? platformCatName(cat.key, t, i18n.language) : cat.key);
  // صورة المالكة المخصّصة تُحسَّن بحجم أصغر وصيغة تلقائية لظهور أسرع؛ والأيقونة الثابتة كما هي
  // ‏WebP لا PNG: النسختانِ بالمجلّدِ نفسِه، والـWebP عُشرُ الحجمِ بالشكلِ نفسِه.
  // كان المسارُ مكتوباً هنا بيدٍ صريحةٍ ‎(.png) فيتجاوزُ مُنتقيَ الصيغةِ المشترَك.
  // صورةُ التاجرةِ تُقَصُّ هوامشُها وتُوضَعُ بمربّعٍ بنفسِ نسبةِ السبعِ المدمجة
  const src = cat.image ? catImage(cat.image, 400) : cat.builtin ? platformCatImage(cat.key) : '';
  const srcPng = cat.image || !cat.builtin ? '' : platformCatImageFallback(cat.key);
  return (
    <div className="w-full transition duration-300 group-hover:-translate-y-1">
      {/* بلا أرضيّةٍ ولا إطار: شكلُ الرسمِ وحدَه يظهر. الرسومُ مقصوصةٌ على
          شفافيّةٍ أصلاً، فالإطارُ يحبسُها ويجعلُ منها أزراراً لا رسوماً.
          ويبقى ‎aspect-square ليتساوى مقاسُ الجميعِ بالصفّ.
          و‎object-contain للجميعِ بلا استثناء: كانت صورةُ الفئةِ التي ترفعُها
          التاجرةُ تُقَصُّ ‎(cover) فتظهرُ ناقصةً وبمقاسٍ يخالفُ جاراتِها —
          والقصُّ هنا لا مبرّرَ له، الصندوقُ واحدٌ والاحتواءُ يملؤُه بلا بتر. */}
      <div className="bz-cattile relative flex aspect-square items-center justify-center">
        {/* هالةٌ ناعمةٌ تتوهّجُ خلفَ الأيقونةِ عند المرور — لمسةُ بوتيكٍ راقية */}
        <span aria-hidden className="pointer-events-none absolute inset-0 m-auto h-2/3 w-2/3 rounded-full bg-gold-400/25 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
        {src ? (
          <img
            src={src}
            // ‏PNG احتياطاً لمتصفّحٍ لا يعرفُ WebP — مربّعٌ فارغٌ مكانَ الفئةِ أسوأُ من كيلوباتٍ زائدة
            onError={(e) => { if (srcPng && e.currentTarget.src !== srcPng) e.currentTarget.src = srcPng; }}
            alt={label}
            loading="eager"
            decoding="async"
            className="relative h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          // فئة بلا صورة (مخصّصة، أو عامّة لقسم الأحذية/الإكسسوارات) → أيقونة قسمها
          <CatIcon cat={cat.platform || cat.key} dept={cat.dept || catDept(cat.key)} className="relative h-1/2 w-1/2 text-wine/70 transition-transform duration-500 group-hover:scale-105" strokeWidth={1.1} />
        )}
      </div>
      <div className="pt-2.5 text-center">
        <span className="text-[0.78rem] font-semibold text-wine sm:text-sm">{label}</span>
      </div>
    </div>
  );
}

function Arrow({ dir, rtl, onClick, disabled = false }) {
  const RIGHT = 'M9 6l6 6-6 6'; // chevron ›
  const LEFT = 'M15 6l-6 6 6 6'; // chevron ‹
  // السابق نحو البداية، التالي نحو النهاية — يتبع اتجاه اللغة
  const path = dir === 'prev' ? (rtl ? RIGHT : LEFT) : (rtl ? LEFT : RIGHT);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'next' ? 'next' : 'prev'}
      // mb-6 يرفع السهم ليتوسّط مع الصورة (يعوّض ارتفاع اسم الفئة أسفل البطاقة)
      className="mb-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-wine/20 bg-white text-wine shadow-sm transition hover:bg-wine hover:text-cream disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  );
}

// العنصرُ خارجَ المكوّنِ الأب قصداً. كان مُعرَّفاً داخلَ جسمِه، ودالّةٌ تُعرَّفُ
// داخلَ الرِندرِ تصيرُ نوعاً جديداً بكلِّ رِندر — فيرى رياكت نوعاً مختلفاً فيهدمُ
// الشجرةَ كلَّها ويبنيها من الصفر: تُفكَّكُ عُقَدُ الـDOM، وتُطلَبُ الصورُ ثانيةً،
// وتُعادُ حركةُ الدخول. وكان هذا يقعُ بكلِّ تغييرِ حالةٍ لا عند الأسهمِ وحدَها.
function Item({ cat, active, onSelect }) {
  const isActive = active === cat.key;
  // ‏w-full: الزرّ بطبعه بعرض محتواه لا بعرض عموده — بسفاري (آيفون) كانت البلاطة
  // تنكمش ما دامت صورتها لم تصل، فيظهر الاسم وحده بمنتصف الصفّ
  const cls = `group block w-full transition-all duration-300 hover:-translate-y-1.5 ${isActive ? 'ring-2 ring-wine ring-offset-2 ring-offset-cream rounded-2xl' : ''}`;
  return onSelect ? (
    <button type="button" onClick={() => onSelect(isActive ? 'all' : cat.key)} className={cls}>
      <CategoryCard cat={cat} />
    </button>
  ) : (
    <Link to={`/category/${cat.key}`} className={cls}>
      <CategoryCard cat={cat} />
    </Link>
  );
}

// صفُّ الفئات — كلُّ الفئاتِ مرسومةٌ دائماً بصفٍّ واحدٍ يُسحَبُ بالإصبع (كقصصِ إنستغرام).
//
// كان كاروسيلاً بصفحات: الصفحةُ تنزاحُ كاملةً بضغطةِ السهم، وآخرُ صفحةٍ تحملُ ما تبقّى
// — فقسمُ الأحذية (خمسُ فئاتٍ، اثنتانِ بالصفحة) كانت صفحتُه الأخيرةُ فئةً وحيدةً بمنتصفِ
// فراغ: تنزلقُ الفئاتُ خارجَ الشاشةِ وتحلُّ محلَّها واحدة، فيُقرأُ الانتقالُ قطعاً واختفاءً.
// الآن البلاطةُ بمقاسٍ ثابتٍ ومكانٍ ثابت، والجوّالُ يُظهرُ طرفَ التالية ليدلَّ على المزيد،
// والسحبُ تمريرٌ أصليٌّ للمتصفّح (بالقصورِ الذاتيّ والتثبيتِ على البلاطة) لا حركةٌ مكتوبة.
// الأسهمُ للحاسوبِ تُمرِّرُ بمقدارِ ما يظهر.
// cats: قائمة كائنات {key, name, image, builtin}. إن لم تُمرَّر، نبني من الفئات الأصلية.
export default function CategoryGrid({ onSelect, active, images = {}, names = {}, cats }) {
  const { i18n } = useTranslation();
  const platformKeys = usePublicCatKeys();
  const rtl = i18n.language !== 'en';
  const list = cats && cats.length
    ? cats
    : platformKeys.map((k) => ({ key: k, name: names[k], image: images[k], builtin: true }));
  const [perPage, setPerPage] = useState(getPerPage());

  useEffect(() => {
    const onResize = () => setPerPage(getPerPage());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const overflow = list.length > perPage;
  // الجوّالُ يُظهرُ اثنتينِ وطرفَ الثالثة؛ الأوسعُ يُظهرُ عددَه كاملاً والأسهمُ تكمل
  const visible = overflow && perPage <= 2 ? perPage + 0.45 : perPage;
  const basis = `calc((100% - ${Math.ceil(visible) - 1} * var(--bz-cat-gap)) / ${visible})`;

  const scRef = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: !overflow });
  useEffect(() => {
    const el = scRef.current;
    if (!el) return undefined;
    let raf = 0;
    const read = () => {
      raf = 0;
      const max = el.scrollWidth - el.clientWidth;
      const x = Math.abs(el.scrollLeft); // بالعربيّة scrollLeft سالبٌ من الصفر
      setEdge((e) => {
        const n = { start: x < 4, end: x > max - 4 };
        return n.start === e.start && n.end === e.end ? e : n;
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [list.length, perPage]);

  // «التالي» نحو نهايةِ القائمة: يساراً بالعربيّة، يميناً بالإنجليزيّة
  const go = (d) => {
    const el = scRef.current;
    if (!el) return;
    el.scrollBy({ left: d * (rtl ? -1 : 1) * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  return (
    <div className="bz-catrow flex items-center gap-2 sm:gap-3">
      {overflow && perPage > 2 && <Arrow dir="prev" rtl={rtl} onClick={() => go(-1)} disabled={edge.start} />}
      {/* ‎py-2 ‎-my-2 و‎px-1 ‎-mx-1: رفعةُ البلاطةِ عند المرورِ وحلقةُ الفئةِ النشطةِ
          يخرجانِ عن الصندوق، وحدُّ التمريرِ يقصُّهما. الحشوةُ تفتحُ لهما مجالاً
          والهامشُ السالبُ يسحبُ المقدارَ نفسَه فلا يتغيّرُ مقاسُ الصفّ. */}
      <div
        ref={scRef}
        dir={rtl ? 'rtl' : 'ltr'}
        className={`bz-catscroll -mx-1 -my-2 flex min-w-0 flex-1 gap-3 px-1 py-2 sm:gap-4 ${overflow ? 'snap-x snap-mandatory overflow-x-auto overscroll-x-contain' : 'justify-center overflow-hidden'}`}
      >
        {list.map((cat) => (
          <div key={cat.key} className="min-w-0 snap-start" style={{ flex: `0 0 ${basis}` }}>
            <Item cat={cat} active={active} onSelect={onSelect} />
          </div>
        ))}
      </div>
      {overflow && perPage > 2 && <Arrow dir="next" rtl={rtl} onClick={() => go(1)} disabled={edge.end} />}
    </div>
  );
}
