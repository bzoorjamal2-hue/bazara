import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getStoreScope, subscribeStoreScope } from '../utils/storeScope.js';
import { useTranslation } from 'react-i18next';
import { trackPath } from '../utils/links.js';
import { useCart } from '../context/CartContext.jsx';
import useHideOnScroll from '../hooks/useHideOnScroll.js';
import { useWishlist } from '../context/WishlistContext.jsx';

// فأرةٌ على شاشةٍ عريضة؟ نفسُ شرط الـCSS حرفاً بحرف — لو افترقا لظهر الشريطُ
// بشكلٍ ويتصرّف بآخر. والعرضُ وحده لا يكفي: آيباد برو أفقيّاً 1366px لكنّه يدٌ
// لا فأرة، فيبقى شريطُه أسفل كالهاتف.
// useSyncExternalStore هو الصحيح لمصدرٍ خارج React.
const DESKTOP = '(min-width: 900px) and (hover: hover) and (pointer: fine)';
const mq = () => (typeof window === 'undefined' ? null : window.matchMedia(DESKTOP));
const subDesktop = (cb) => {
  const m = mq();
  if (!m) return () => {};
  // resize مع change: الأوّل حزامُ أمان. رأيتُ الشريطَ يبقى ببنودِ الجوّال بعد
  // توسيعِ النافذة لأنّ حدثَ change لم يصل، فبقي البندُ المكرّر ظاهراً على
  // شاشةٍ عريضة. resize يصل دائماً، وقراءةُ matches رخيصة.
  m.addEventListener('change', cb);
  window.addEventListener('resize', cb);
  return () => { m.removeEventListener('change', cb); window.removeEventListener('resize', cb); };
};
const useDesktop = () => useSyncExternalStore(
  subDesktop,
  () => Boolean(mq()?.matches),
  () => false,   // بالخادم: نفترض الجوّال فيظهر البندُ ولا يختفي خطأً
);
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

// البيتُ كما هو عندَ إنستغرام: كتلةٌ واحدةٌ بلا باب، قمّتُها مدوّرةٌ لا مدبّبة
// وقاعُها بأركانٍ مستديرة. كنتُ رسمتُه بباب — وليس لها باب.
//
// والممتلئُ يُرسَمُ بحشوٍ وحدٍّ باللونِ نفسِه: الحدُّ بوصلاتٍ مستديرةٍ يُدوّرُ
// الأركانَ الحادّةَ للقمّةِ والإفريزَين، وهو ما لا يفعلُه الحشوُ وحدَه.
function HomeIcon({ className = 'h-6 w-6', filled }) {
  // أعرضُ وأقصرُ ممّا رسمتُ أوّلاً: سقفُها منبسطٌ لا مدبَّب، وجدرانُها قصيرة.
  const body = 'M12 4.1 20.6 10.9V18.4A2.4 2.4 0 0 1 18.2 20.8H5.8A2.4 2.4 0 0 1 3.4 18.4V10.9L12 4.1Z';
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
        <path d={body} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={body} />
    </svg>
  );
}
function UserIcon({ className = 'h-6 w-6', filled }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function CategoriesIcon({ className = 'h-6 w-6', filled }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </svg>
  );
}
function OffersIcon({ className = 'h-6 w-6', filled }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 13.3 13.3 20.5a1.5 1.5 0 0 1-2.1 0l-7.7-7.7V4.5a1 1 0 0 1 1-1h8.3l7.7 7.7a1.5 1.5 0 0 1 0 2.1Z" />
      <circle cx="7.5" cy="7.5" r="1.3" fill={filled ? 'none' : 'currentColor'} />
    </svg>
  );
}
function TrackIcon({ className = 'h-6 w-6', filled }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H14a1 1 0 0 1 1 1v9H3.5A.5.5 0 0 1 3 14.5Z" />
      <path d="M15 8h3.2a1 1 0 0 1 .8.4l2 2.7a1 1 0 0 1 .2.6V15h-6Z" />
      <circle cx="7.5" cy="17.5" r="1.7" fill="none" />
      <circle cx="17" cy="17.5" r="1.7" fill="none" />
    </svg>
  );
}
// الريلز عندَها ليست شريطَ فيلم: مربّعٌ مستديرُ الأركانِ وبداخلِه مثلّثُ تشغيلٍ
// مفرّغٌ بالسُّمكِ نفسِه. رسمتُها أوّلاً لوحةَ إخراجٍ بمائلَينِ وخطٍّ — ذاك شكلُها
// القديم، والصورةُ التي أرسلَها تُظهِرُ الشكلَ الحاليّ.
function ReelsIcon({ className = 'h-6 w-6', filled }) {
  const play = 'M10.4 8.9 16 12 10.4 15.1Z';
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        {/* الممتلئةُ تُبقي المثلّثَ ثقباً بداخلِها — لا كتلةً صمّاء */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d={`M8.4 2.9h7.2c3 0 5.5 2.5 5.5 5.5v7.2c0 3-2.5 5.5-5.5 5.5H8.4c-3 0-5.5-2.5-5.5-5.5V8.4c0-3 2.5-5.5 5.5-5.5Z ${play}`}
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.9" y="2.9" width="18.2" height="18.2" rx="5.5" />
      <path d={play} />
    </svg>
  );
}

// شريط تنقّل سفلي بأسلوب التطبيقات (يظهر داخل التطبيق المثبّت فقط).
export default function BottomNav() {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { count, setOpen, open: cartOpen } = useCart();
  const { count: wishCount, setOpen: setWishOpen, open: wishOpen } = useWishlist();
  const { user, store, subscription } = useAuth();
  const isAdmin = subscription?.isAdmin;

  // عدّاد الطلبات الجديدة لصاحب المتجر — شارة على تبويب "حسابي"
  const [newOrders, setNewOrders] = useState(0);
  useEffect(() => {
    if (!user || !store?.slug) { setNewOrders(0); return undefined; }
    let alive = true;
    const load = () => api.get('/orders/new-count').then((r) => { if (alive) setNewOrders(r.data.count || 0); }).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    // تحديث فوري عند تأكيد/شحن طلب من قائمة الطلبات (بدل انتظار الاستطلاع) — لا تعليق
    window.addEventListener('bz:orders-changed', load);
    return () => { alive = false; clearInterval(id); window.removeEventListener('focus', onFocus); window.removeEventListener('bz:orders-changed', load); };
  }, [user, store?.slug]);

  // إخفاء الشريط أثناء فتح أي نافذة/درج (قفل التمرير يجعل body ثابتاً position:fixed —
  // وعلى iOS يجعل الشريط fixed يتموضع نسبةً لـ body فيطفو لنص الشاشة). نخفيه فيرجع
  // محلّه بالأسفل تماماً بعد الإغلاق. النوافذ تغطّي الشاشة فلا حاجة له أثناءها.
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const check = () => setLocked(document.body.style.position === 'fixed');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => obs.disconnect();
  }, []);

  // إخفاء الشريط عند فتح لوحة المفاتيح (التركيز على حقل نصّي) — كي لا يطفو فوق الكيبورد.
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const isText = (el) => el && (el.tagName === 'TEXTAREA' ||
      (el.tagName === 'INPUT' && !['button', 'submit', 'checkbox', 'radio', 'range', 'file', 'color', 'image'].includes(el.type)));
    const onIn = (e) => { if (isText(e.target)) setKbOpen(true); };
    const onOut = () => { setTimeout(() => { if (!isText(document.activeElement)) setKbOpen(false); }, 60); };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); };
  }, []);

  // موضعه يتبع «المنفذ المرئي» لا التخطيطي.
  //
  // على iOS يبقى العنصر fixed مربوطاً بالمنفذ التخطيطي: يفتح الكيبورد أو يتحرّك
  // شريط العنوان أو ينتهي تمرير بالزخم — فيطفو الشريط لنصّ الشاشة ويعلق هناك حتى
  // تمرير جديد. visualViewport يعطينا الحافّة السفلية المرئية فعلاً، فنزحزح الشريط
  // إليها مع كل تغيّر. النتيجة: يظلّ بالقاع دائماً مهما فعل النظام.
  const [vvInset, setVvInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const inset = Math.round(window.innerHeight - vv.height - vv.offsetTop);
        setVvInset(inset > 1 ? inset : 0);
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // إخفاء الشريط عند ظهور شريط الشراء الثابت في صفحة المنتج (يحلّ محلّه بنفس الموضع)
  const [buyBar, setBuyBar] = useState(false);
  useEffect(() => {
    const on = (e) => setBuyBar(!!e.detail);
    window.addEventListener('bz:buybar', on);
    return () => window.removeEventListener('bz:buybar', on);
  }, []);

  // "حسابي" يفتح دائماً على الصفحة الرئيسية للوحة — لا نجبر المستخدم على تبويب
  // الطلبات (كان يفتحه تلقائياً عند وجود طلبات جديدة فيبدو وكأنه عالق عليه).
  // الشارة الحمراء تكفي للتنبيه، والإشعارات توصله للطلبات مباشرة عند الحاجة.
  const accountTo = user ? '/dashboard' : '/login';
  // المتجر الذي يتصفّحه الزائر الآن: من الرابط (/store/:slug)، أو ?store= (بحث/فئة/تتبّع)،
  // أو من ذاكرة الجلسة لصفحة المنتج (رابطها لا يحمل السلاِگ). عند وجوده تبقى كل وجهات
  // الشريط داخل المتجر — فلا يخرج الزبون لصفحات بازارا العامة إطلاقاً.
  const viewingStoreSlug = (pathname.match(/^\/store\/([^/]+)/) || [])[1] || '';
  const searchStoreSlug = new URLSearchParams(search).get('store') || '';
  const productScope = useSyncExternalStore(subscribeStoreScope, getStoreScope);
  const scopeSlug = viewingStoreSlug || searchStoreSlug || (pathname.startsWith('/product/') ? productScope : '');
  const inStore = Boolean(scopeSlug); // نحن فعلاً داخل سياق متجر الآن (يُستخدم لتفعيل التبويبات)
  // متجر المشترك نفسه — المدير مستثنى (يدير المنصّة لا متجراً)، والاشتراك المنتهي مستثنى
  // (متجره مُطفأ يرجّع «غير موجود»، فنُبقي وجهاته على بازارا العام بدل صفحة خطأ).
  const ownStore = user && store?.slug && !isAdmin && subscription?.active ? store.slug : '';
  // وجهة "متجري": المتجر المتصفَّح حالياً، وإلا متجر المشترك نفسه. هكذا تبقى كل وجهات
  // الشريط (رئيسية/عروض/تتبّع/تصنيفات/ريلز) ضمن متجر المشترك بهويّته — حتى قبل أن يفتح
  // صفحة متجره — فلا تظهر شعارات بازارا العامة داخل حسابه. الزائر/الزبون بلا متجر تبقى
  // وجهاته عامة إلا وهو داخل متجر فعلاً.
  const destSlug = scopeSlug || ownStore;
  const inDest = Boolean(destSlug);

  // "الرئيسية": متجري (المتصفَّح أو متجر المشترك) وإلا بازارا العام (زائر/مدير)
  const homeTo = inDest ? `/store/${destSlug}` : '/shop';
  // داخل متجر: نستثني view/offers/cats=1 كي لا تبقى "الرئيسية" مضلّلة فوقها.
  // بالموقع العام: /shop?cat= يعرض الفئة داخل الرئيسية نفسها → تبقى "الرئيسية" مفعّلة.
  const homeActive = pathname === homeTo.split('?')[0]
    && (inStore ? !/[?&](view|offers|cats?)=/.test(search) : true);
  // التصنيفات داخل المتجر تفتح صفحة تصنيفات المتجر (?cats=1) بهوية المتجر — لا صفحة
  // بازارا العامة ولا درج جانبي. تبقى مفعّلة على تلك الصفحة، وعلى فئة/تصنيفات العام.
  const categoriesActive = inStore
    ? /[?&]cats=1/.test(search)
    : (pathname === '/categories' || pathname.startsWith('/category/'));
  // العروض/التتبّع/التصنيفات تبقى ضمن متجري (بدل صفحات بازارا العامة) طالما لي متجر
  const offersTo = inDest ? `/store/${destSlug}?offers=1` : '/offers';
  const offersActive = inStore ? /[?&]offers=1/.test(search) : pathname === '/offers';
  const trackTo = trackPath(destSlug);
  // ريلز: متجر التصفّح الحالي، أو متجر المشترك نفسه، أو العام (كل متجر له ريلز خاص)
  const reelsTo = destSlug ? `/store/${destSlug}/reels` : '/reels';
  const reelsActive = pathname.endsWith('/reels');
  // إغلاق أدراج السلة/المفضلة قبل الانتقال (الشريط يبقى ظاهراً فوق الأدراج)
  const closeDrawers = () => { setOpen(false); setWishOpen(false); };
  // الضغط على تبويب أنتِ عليه أصلاً يمرّر لأعلى (نفس سلوك الشعار) بدل ألا يفعل شيئاً
  const goto = (to) => {
    closeDrawers();
    // نقارن الرابط كاملاً (مع الاستعلام) — كي ينتقل من رئيسية المتجر إلى ?offers=1/?view=all
    // بدل أن يكتفي بالتمرير لأعلى لتطابق المسار وحده.
    if (pathname + search === to) window.scrollTo({ top: 0, behavior: 'smooth' });
    else navigate(to);
  };
  // "التصنيفات" داخل متجر → صفحة تصنيفات المتجر (?cats=1): تلبس هيدر/فوتر المتجر
  // وتعرض شبكة فئاته كصفحة كاملة، فلا يخرج الزبون للموقع العام ولا يفتح درجاً.
  const categoriesTo = inDest ? `/store/${destSlug}?cats=1` : '/categories';
  // السلة والمفضّلة موجودتان بالشريط العلوي بحد الأفاتار، فنستبدلهما بوجهات أنفع.
  // الترتيب يتبع اتجاه اللغة تلقائياً: عربي (حسابي أولاً يميناً)، إنجليزي (يساراً).
  // عرضٌ عريض؟ نقرؤه مرّةً ونتابع تغيّره — البندُ المكرّر يُخفى هناك.
  const dt = useDesktop();
  const items = [
    // «حسابي» يُخفى على الكمبيوتر: هو أصلاً بالشريط العلويّ بحدّ
    // الصورة الشخصية، فوجودُه هنا تكرارٌ يزحم صفّاً محدود العرض.
    // (dt = شاشةٌ عريضة)
    ...(dt ? [] : [{ key: 'account', label: t('nav.account') || 'حسابي', Icon: UserIcon, active: !cartOpen && !wishOpen && pathname.startsWith('/dashboard'), badge: newOrders, onClick: () => goto(accountTo) }]),
    { key: 'track', label: t('nav.track'), Icon: TrackIcon, active: !cartOpen && !wishOpen && (pathname === '/track' || pathname.endsWith('/track')), onClick: () => goto(trackTo) },
    { key: 'offers', label: t('nav.offers'), Icon: OffersIcon, active: !cartOpen && !wishOpen && offersActive, onClick: () => goto(offersTo) },
    { key: 'reels', label: t('reels.title'), Icon: ReelsIcon, active: !cartOpen && !wishOpen && reelsActive, onClick: () => goto(reelsTo) },
    { key: 'categories', label: t('nav.categories'), Icon: CategoriesIcon, active: !cartOpen && !wishOpen && categoriesActive, onClick: () => goto(categoriesTo) },
    { key: 'home', label: t('nav.home'), Icon: HomeIcon, active: !cartOpen && !wishOpen && homeActive, onClick: () => goto(homeTo) },
  ];

  const hidden = locked || kbOpen || buyBar;

  // يغيبُ مع النزولِ ويعودُ بأصغرِ رفعةٍ — الهوكُ نفسُه الذي يخدمُ الهيدر،
  // فيغيبانِ معاً ويعودانِ معاً بعتبةٍ واحدةٍ لا باثنتين تختلفان.
  // وعلى الفأرةِ لا يغيب: الشريطُ هناك علويٌّ لا سفليّ، والهيدرُ يلتصقُ
  // تحته بمقدارِ ارتفاعِه — فإخفاؤه يسحبُ الأرضَ من تحتِ الهيدر.
  const away = useHideOnScroll({ paused: dt || hidden, resetKey: pathname });

  // الأزرارُ العائمةُ تتبعُ الشريطَ لا تعلّقُ بالهواء: ترتفعُ لتتجنّبَه،
  // فإن غاب نزلت مكانَه بالمدّةِ نفسِها. والصنفُ للغيابِ بالتمريرِ وحدَه:
  // درجٌ مفتوحٌ أو لوحةُ مفاتيحٍ تغطّي الشاشةَ أصلاً، وإنزالُ الأزرارِ تحتَ
  // لوحةِ المفاتيحِ يخبّئُها لا يرتّبُها.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('bz-tabbar-off', !dt && away && !hidden);
    return () => root.classList.remove('bz-tabbar-off');
  }, [dt, away, hidden]);

  // ارتفاعُ الشريط يُقاس ولا يُخمَّن.
  //
  // على الشاشة العريضة يصعد هذا الشريطُ للأعلى، ويلتصق الهيدرُ تحته بمقدار
  // ارتفاعه (‎--bz-tabbar-h‎ بـindex.css، وهو يقرأ قياسَنا هذا). كان المقدارُ
  // رقماً مكتوباً باليد، وهو يفترق عن الواقع بتغيّر اللغة أو حجم الخطّ أو عدد
  // البنود — فيبقى بينهما
  // خيطٌ فارغ أو يزحف أحدُهما تحت الآخر. ResizeObserver يبقيهما متراصَّين مهما
  // تغيّر الشريط. وحين يختفي الشريط (درجٌ مفتوح · شريطُ شراء · شاشةُ لمس)
  // نصفّر المقدار فيرجع الهيدرُ إلى الحافّة بدل فراغٍ تحت شريطٍ غير موجود.
  const barRef = useRef(null);
  useEffect(() => {
    const root = document.documentElement;
    const el = barRef.current;
    const clear = () => root.style.setProperty('--bz-tabbar-measured', '0px');
    if (!el || !dt || hidden) { clear(); return undefined; }
    const set = () => root.style.setProperty('--bz-tabbar-measured', `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); clear(); };
  }, [dt, hidden]);

  if (hidden) return null; // نافذة/درج/كيبورد مفتوح أو شريط شراء ظاهر → نخفي الشريط (يرجع تلقائياً)

  // بلا backdrop-blur: ضبابية دائمة فوق المحتوى تُرهق معالج الرسم مع كل فريم تمرير،
  // والخلفية 95% معتمة أصلاً فالفرق البصري صفر والفرق بالأداء محسوس
  return (
    <nav
      ref={barRef}
      /* كبسولةٌ طافيةٌ على اللمسِ وحدَه: هناك هو شريطُ إبهامٍ سفليٌّ
         كإنستغرام. وعلى الفأرةِ يصعدُ شريطاً علويّاً ممتدّاً يلتصقُ به الهيدر،
         فتدويرُه وإطافتُه تكسرُ ذلك التراصّ. والتمييزُ بـdt لا بـmedia لأنَّ
         كتلةَ الكمبيوترِ بالـCSS تُعيدُ تعريفَ الموضعِ والحدِّ فتتصارعان. */
      className={`bz-tabbar fixed z-[78] bg-white/95 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        dt
          ? 'inset-x-0 bottom-0 border-t border-wine/10 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-6px_20px_rgba(75,74,73,0.08)]'
          : 'inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+10px)] mx-auto max-w-md rounded-[26px] border border-wine/10 px-1 py-2 shadow-[0_16px_36px_-14px_rgba(15,15,14,0.48),0_3px_10px_-6px_rgba(15,15,14,0.20)]'
      }`}
      style={
        vvInset || away
          // التحويلانِ يتركّبانِ ولا يتنازعان: الأوّلُ يلاحقُ المنفذَ المرئيَّ
          // على iOS، والثاني ينزلُ به خارجَ الشاشة. والمقدارُ أكبرُ من مئةٍ
          // بالمئة ليبتلعَ الفرجةَ السفليّةَ والظلَّ معها.
          ? { transform: `translateY(${-vvInset}px)${away ? ' translateY(calc(100% + 28px))' : ''}` }
          : undefined
      }
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {items.map(({ key, label, Icon, active, badge, onClick }) => (
          <button
            key={key}
            onClick={onClick}
            data-cart-target={key === 'cart' ? '' : undefined}
            /* الاسمُ يبقى للفأرةِ وللقارئِ الصوتيّ. وبلا نصٍّ ظاهرٍ يصيرُ الزرُّ
               بلا اسمٍ مقروء، فنكتبُه سمةً — أيقونةٌ عاريةٌ بلا aria-label زرٌّ
               أخرسُ عندَ من يسمعُ الصفحةَ ولا يراها. */
            aria-label={label}
            className={`${active ? 'is-on ' : ''}relative flex min-w-0 flex-1 flex-col items-center py-1 text-[10px] font-medium leading-tight transition ${dt ? 'gap-1' : ''} ${
              active ? 'text-wine' : 'text-stone-400'
            }`}
          >
            {/* تظليل التبويب الفعّال: حبّة خمرية حول الأيقونة ليعرف المستخدم مكانه */}
            <span className={`relative flex items-center justify-center rounded-2xl px-3.5 py-1 transition-all duration-200 active:scale-90 ${active ? 'bg-wine text-cream shadow-sm' : ''}`}>
              {/* نطّة صغيرة للأيقونة لحظة تفعيل التبويب — إحساس أصلي كإنستغرام */}
              <Icon className={`h-6 w-6 transition-transform duration-300 ${active ? 'animate-tab-pop' : ''}`} filled={active} />
              {badge > 0 && (
                // شارة فاخرة: هالة نابضة خلفها لجذب الانتباه + حبّة ذهبية متدرّجة بحدّ عاجي
                <span className="absolute -end-1 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400/60" style={{ animationDuration: '1.8s' }} />
                  <span className="relative flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none text-wine-dark shadow-md ring-[1.5px] ring-cream" style={{ background: 'linear-gradient(135deg, #DDDDDC 0%, #BAB9B7 55%, #999795 100%)' }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                </span>
              )}
            </span>
            {/* الأيقونةُ تقولُ ما يقولُه الاسمُ تحتَها: بيتٌ وشبكةٌ وسلّةٌ وشاحنةٌ
                ووجهٌ — لا واحدةَ منها تحتاجُ شرحاً. والسطرُ يرفعُ الشريطَ نحوَ
                الثلثِ بلا أن يضيف. يبقى على الفأرةِ حيث الشريطُ علويٌّ ممتدٌّ
                والمساحةُ فائضة، والاسمُ فيه بجانبِ الأيقونةِ لا تحتَها. */}
            {dt && <span className={`max-w-full truncate ${active ? 'font-bold' : ''}`}>{label}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}
