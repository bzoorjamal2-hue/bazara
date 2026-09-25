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
  return 6;
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

function Arrow({ dir, rtl, onClick }) {
  const RIGHT = 'M9 6l6 6-6 6'; // chevron ›
  const LEFT = 'M15 6l-6 6 6 6'; // chevron ‹
  // السابق نحو البداية، التالي نحو النهاية — يتبع اتجاه اللغة
  const path = dir === 'prev' ? (rtl ? RIGHT : LEFT) : (rtl ? LEFT : RIGHT);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'next' ? 'next' : 'prev'}
      // mb-6 يرفع السهم ليتوسّط مع الصورة (يعوّض ارتفاع اسم الفئة أسفل البطاقة)
      className="mb-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-wine/20 bg-white text-wine shadow-sm transition hover:bg-wine hover:text-cream"
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

// شبكة/كاروسيل الفئات — تظهر بعدد متجاوب مع الشاشة، مع أسهم ونقاط عند الحاجة.
// cats: قائمة كائنات {key, name, image, builtin}. إن لم تُمرَّر، نبني من الفئات الأصلية الخمس.
export default function CategoryGrid({ onSelect, active, images = {}, names = {}, cats }) {
  const { i18n } = useTranslation();
  const platformKeys = usePublicCatKeys();
  const rtl = i18n.language !== 'en';
  const list = cats && cats.length
    ? cats
    : platformKeys.map((k) => ({ key: k, name: names[k], image: images[k], builtin: true }));
  const [perPage, setPerPage] = useState(getPerPage());
  const [page, setPage] = useState(0);

  useEffect(() => {
    const onResize = () => setPerPage(getPerPage());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pages = Math.ceil(list.length / perPage);
  useEffect(() => { setPage((p) => Math.min(p, pages - 1)); }, [pages]);

  const hasNav = list.length > perPage;
  const go = (d) => setPage((p) => (p + d + pages) % pages);

  // صفحاتٌ غيرُ متداخلةٍ تُرسَمُ كلُّها معاً على شريطٍ واحدٍ يُزاح — لا شريحةٌ
  // تُقتَطعُ بكلِّ ضغطة. كانت ‎slice تبدّلُ البطاقاتِ المعروضةَ ومفاتيحُها تختلف،
  // فتُستبدَلُ عُقَدُ الـDOM وتُطلَبُ صورُ الصفحةِ الجديدةِ من جديد: تختفي
  // البلاطاتُ لحظةً ثمّ تقفزُ ظاهرةً — وهو القطعُ والتعليق. الآن تُبنى مرّةً
  // وتبقى، والانتقالُ تحويلٌ واحدٌ على وحدةِ الرسمِ بلا تخطيطٍ ولا طلبِ شبكة.
  const chunks = Array.from({ length: pages }, (_, p) => list.slice(p * perPage, (p + 1) * perPage));

  // عرضُ النافذةِ بالبكسل — عليه تُبنى الإزاحة. النسبةُ المئويّةُ مرجعُها هنا
  // ملتبس: الشريطُ عرضُه عرضُ نافذةٍ واحدةٍ وأبناؤُه يفيضون خارجَه.
  const frameRef = useRef(null);
  const [frameW, setFrameW] = useState(0);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const read = () => setFrameW(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div>
      <div className="bz-catrow flex items-center gap-2 sm:gap-3">
        {hasNav && <Arrow dir="prev" rtl={rtl} onClick={() => go(-1)} />}
        {/* ‎py-2 ‎-my-2: القَصُّ أفقيٌّ مطلوب، أمّا رأسيّاً فرفعةُ البلاطةِ عند
            المرورِ (‎-translate-y-1.5) وحلقةُ الفئةِ النشطةِ يخرجانِ عن الصندوقِ
            فيُبتَرانِ من فوق. الحشوةُ تفتحُ لهما مجالاً داخلَ حدِّ القَصّ،
            والهامشُ السالبُ يسحبُ المقدارَ نفسَه فلا يزدادُ ارتفاعُ الصفّ. */}
        <div ref={frameRef} className="-my-2 min-w-0 flex-1 overflow-hidden py-2">
          {/* اتّجاهُ الحركةِ يتبعُ اللغةَ كسلايدرِ الهيرو: العربيّةُ ‎row-reverse
              فالأولى يميناً والتاليةُ إلى يسارِها، والإنجليزيّةُ ‎row والعكس. */}
          <div
            className={`flex ${rtl ? 'flex-row-reverse' : ''}`}
            style={{
              transform: `translate3d(${(rtl ? 1 : -1) * page * frameW}px, 0, 0)`,
              direction: 'ltr',
              transition: 'transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1)',
              willChange: 'transform',
            }}
          >
            {chunks.map((chunk, p) => (
              /* صفٌّ مرنٌ لا شبكةٌ بأعمدةٍ ثابتة: الشبكةُ كانت تحجزُ خمسةَ أعمدةٍ دائماً،
                 فآخرُ صفحةٍ تحملُ قطعتَينِ من سبعٍ تتركُ ثلاثةَ أعمدةٍ فارغةٍ على جانبٍ
                 واحدٍ — يبدو القسمُ مكسوراً لا منتهياً. المرونةُ تُبقي مقاسَ البلاطةِ
                 كما هو وتوسّطُ الصفَّ الناقص. */
              <div
                key={p}
                dir={rtl ? 'rtl' : 'ltr'}
                className="flex w-full shrink-0 justify-center gap-3 sm:gap-4"
              >
                {chunk.map((cat) => (
                  <div
                    key={cat.key}
                    className="min-w-0"
                    style={{ flex: `0 0 calc((100% - ${perPage - 1} * var(--bz-cat-gap)) / ${perPage})` }}
                  >
                    <Item cat={cat} active={active} onSelect={onSelect} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        {hasNav && <Arrow dir="next" rtl={rtl} onClick={() => go(1)} />}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-1.5">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              aria-label={`page ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === page ? 'w-5 bg-wine' : 'w-1.5 bg-wine/25'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
