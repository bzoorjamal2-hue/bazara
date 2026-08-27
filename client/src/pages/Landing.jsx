import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import Seo from '../components/Seo.jsx';
import LandingShelf from '../components/LandingShelf.jsx';
import { heroSrc, heroSrcSet } from '../utils/heroImage.js';
import Logo from '../components/Logo.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { switchLanguage } from '../i18n.js';
import CountUp from '../components/CountUp.jsx';
import useInViewOnce from '../hooks/useInViewOnce.js';
import {
  BagIcon, ForwardIcon, TruckIcon, CashIcon, CheckIcon, StoreIcon, ChartIcon,
  InstagramIcon, PackageIcon, SparkleIcon, ShieldIcon, PaletteIcon, TicketIcon,
  UsersIcon, CrownIcon, WhatsAppIcon, MenuIcon, XIcon, ArrowDownIcon, ArrowUpIcon,
  MailIcon, PhoneIcon, PinIcon, ClockIcon,
} from '../components/icons.jsx';
import { BAZARA_WHATSAPP } from '../config/site.js';
import { buildWhatsappLink } from '../utils/whatsapp.js';

// ═══════════════ واجهة بازارا ═══════════════
//
// كانت شاشةَ افتتاحٍ للتطبيق المثبّت وحده: شعار واسمٌ وثلاثة أزرار، ولا تراها
// إلا من نصّبت التطبيق. الزائر من جوجل أو من رابطٍ بإنستغرام كان يهبط مباشرةً
// على شبكة المنتجات بلا أن يعرف ما بازارا ولا لماذا يفتح متجره فيها.
//
// صارت صفحةَ المنصّة: تعمل على كل مقاس، وكلّ نصٍّ فيها يحرّره المدير، وأرقامها
// حيّة من قاعدة البيانات. وكل ألوانها من لوحة الموقع نفسها — لا لون خارجها.

// قسمٌ يظهر بانزلاقٍ خفيف حين يصل إليه النظر (مرّة واحدة، بلا مكتبة)
function Reveal({ children, delay = 0, className = '', id }) {
  const [ref, seen] = useInViewOnce();
  return (
    <div
      ref={ref}
      id={id}
      className={`bz-reveal ${seen ? 'bz-reveal-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// عنوان قسم موحّد: كلمة صغيرة ذهبية فوق، عنوان بخط العرض، وشرح هادئ
function SectionTitle({ eyebrow, title, desc }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="bz-eyebrow">{eyebrow}</p>}
      <h2 className="bz-h2">{title}</h2>
      {desc && <p className="bz-lead mx-auto mt-3 max-w-xl">{desc}</p>}
    </div>
  );
}

// الأزرار الثلاثة — تتكرّر بالأعلى وبالأسفل: التسوّق، الدخول، فتح متجر.
// نصوصُها من المدير إن كتبها، وإلا المترجَمة — وهي أكثرُ ما يُضغط بالصفحة.
function Actions({ t, compact = false, labels }) {
  return (
    <div className={`bz-acts flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center ${compact ? '' : 'sm:gap-4'}`}>
      <Link to="/shop" className="bz-btn-gold">
        <BagIcon className="h-5 w-5" /> {labels?.shop || t('landing.shopNow')}
      </Link>
      <Link to="/login" className="bz-btn-outline">
        {labels?.login || t('nav.login')}
      </Link>
      <Link to="/register" className="bz-btn-ghost">
        <StoreIcon className="h-4 w-4" /> {labels?.open || t('landing.openStore')} <ForwardIcon className="h-3.5 w-3.5 rtl:rotate-180" />
      </Link>
    </div>
  );
}

const FEATURE_ICONS = [StoreIcon, PaletteIcon, TruckIcon, ChartIcon, InstagramIcon, TicketIcon, PackageIcon, ShieldIcon];
const STEP_ICONS = [StoreIcon, PackageIcon, SparkleIcon];

export default function Landing() {
  const { t, i18n } = useTranslation();
  const en = i18n.language === 'en';
  // الذاكرة تدوم: sessionStorage يُمسح بإغلاق التبويب، فكلُّ فتحةٍ للتطبيق
  // تبدأ بلا رابطِ صورة — وهي الحالة المشتكى منها. localStorage يبقى، فتُرسم
  // الصورة من أوّل نبضة وتُحدَّث بالخلفية إن غيّرها المدير.
  const [site, setSite] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('bz_landing') || sessionStorage.getItem('bz_landing') || 'null',
      ) || {};
    } catch { return {}; }
  });
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  // الشريط العلويّ يلبس خلفيته بعد أول نزول. passive حتى لا يعرقل التمرير.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // القائمة الكاملة: نقفل تمرير الصفحة خلفها ونغلقها بـEsc
  useEffect(() => {
    if (!menu) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [menu]);

  // تمريرٌ ناعم لقسمٍ بالصفحة (من القائمة أو من سهم «اعرف أكثر»)
  const goTo = (id) => {
    setMenu(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    api.get('/public/site-info')
      .then((r) => {
        const s = { landing: r.data?.landing || {}, stats: r.data?.stats || null };
        setSite(s);
        try { sessionStorage.setItem('bz_landing', JSON.stringify(s)); } catch { /* ممتلئ */ }
        try {
          localStorage.setItem('bz_landing', JSON.stringify(s));
          // رابطُ الصورة بمفتاحٍ منفصل: السكربتُ الذي يسبق React بالـHTML
          // يقرأه ويحقن preload، فيبدأ التحميلُ موازياً للحزمة لا بعدها.
          // نحفظ ما سيطلبه <img> فعلاً — لا الرابط الخام. التحميل المسبق
          // بالرابط الخام كان يسحب نسخة 1920 قبل أن يختار المتصفّح من srcset،
          // فتُنزَّل الكبيرة ثمّ تُهمَل. والقائمة تُحفظ معه ليحمل الرابطُ
          // المسبق imagesrcset فيتّفق الاثنان على نسخةٍ واحدة.
          const img = s.landing?.hero?.image || '';
          if (img) {
            localStorage.setItem('bz_hero_img', heroSrc(img));
            localStorage.setItem('bz_hero_srcset', heroSrcSet(img) || '');
          } else {
            localStorage.removeItem('bz_hero_img');
            localStorage.removeItem('bz_hero_srcset');
          }
        } catch { /* ممتلئ */ }
      })
      .catch(() => { /* الصفحة كاملة بنصوصها الأصلية بلا الخادم */ });
  }, []);

  const L = site.landing || {};
  // نصّ المدير إن كتبه، وإلا النصّ المترجَم الأصلي — فالصفحة كاملة دائماً
  const pick = (obj, key, fallback) => {
    const v = en ? obj?.[`${key}En`] : obj?.[key];
    return (v && String(v).trim()) || (en ? obj?.[key] : null) || fallback;
  };
  const hidden = new Set(Array.isArray(L.hidden) ? L.hidden : []);

  const hero = L.hero || {};
  const chips = (hero.chips?.length ? hero.chips : null) || [
    { label: t('landing.chip1') }, { label: t('landing.chip2') }, { label: t('landing.chip3') },
  ];
  const chipIcons = [TruckIcon, CashIcon, CheckIcon, ShieldIcon];

  const features = useMemo(() => {
    if (L.features?.length) return L.features;
    return t('landing.features', { returnObjects: true }) || [];
  }, [L.features, t]);

  const steps = useMemo(() => {
    if (L.steps?.length) return L.steps;
    return t('landing.steps', { returnObjects: true }) || [];
  }, [L.steps, t]);

  // شهاداتُ المدير وحدها — بلا نصٍّ افتراضيّ.
  //
  // كان بملفّ الترجمة ثلاثُ شهاداتٍ مكتوبةٍ للتعبئة، تُعرض على موقعٍ منشورٍ
  // موقّعةً بـ«صاحبة متجر · رام الله» و«· نابلس». والزائرة تقرأها تجاربَ
  // فعلية — وهي ليست كذلك. شهادةٌ مُختلَقة على صفحةٍ تطلب مالاً وثقةً ليست
  // نصّاً مؤقّتاً، وانكشافُها يكلّف ثقةً أغلى بكثير ممّا تجلب.
  // القسم الآن يظهر حين تكون هناك شهادةٌ حقيقية، ويغيب حين لا تكون.
  const testimonials = Array.isArray(L.testimonials) ? L.testimonials : [];
  const faq = L.faq?.length ? L.faq : (t('landing.faq', { returnObjects: true }) || []);
  const stats = site.stats;
  // عنوانُ قسمٍ: ما كتبه المدير إن كتبه، وإلا النصّ المترجَم الأصلي.
  // كان المدير يحرّر بنودَ القسم ولا يحرّر العنوانَ فوقها.
  const sec = (key, field, fallbackKey) => pick(L.sec?.[key] || {}, field, t(fallbackKey));
  const acts = {
    shop: pick(L.acts || {}, 'shop', t('landing.shopNow')),
    login: pick(L.acts || {}, 'login', t('nav.login')),
    open: pick(L.acts || {}, 'open', t('landing.openStore')),
  };
  // عتبةُ كلّ رقم: دونها لا يُعرض
  const STAT_FLOOR = { stores: 6, products: 25, orders: 50 };
  const shownStats = !stats ? [] : [
    { key: 'stores', n: stats.stores, label: t('landing.statStores'), Icon: StoreIcon },
    { key: 'products', n: stats.products, label: t('landing.statProducts'), Icon: PackageIcon },
    { key: 'orders', n: stats.orders, label: t('landing.statOrders'), Icon: BagIcon },
  ].filter((x) => Number(x.n) >= STAT_FLOOR[x.key]);
  const L_ = L;
  const contact = L.contact || {};

  return (
    <div className="bz-land">
      {/* وصفُ نتائج البحث: أوّلُ ما يُقرأ عن المنصّة، ومنه جاء ادّعاءُ
          «عشرات المتاجر» الذي بقي حتى فحصتُه. صار تحت يد المدير. */}
      <Seo
        title={pick(L.seo || {}, 'title', t('landing.seoTitle'))}
        description={pick(L.seo || {}, 'desc', t('landing.seoDesc'))}
      />

      {/* ─────────── الهيرو ─────────── */}
      <header
        className="bz-hero bz-grain"
        // التعتيم من لوحة المدير: صورةٌ فاتحة تبتلع النصّ الأبيض فوقها،
        // وصورةٌ داكنة لا تحتاج حجاباً ثقيلاً. رقمٌ واحد يضبط الحالتين.
        style={{ '--bz-dim': (hero.dim ?? 62) / 100 }}
      >
        {/* خلفية الهيرو: فيديو يضعه المدير، أو صورة، أو تدرّج الهوية وحده.
            الفيديو صامتٌ ويعمل داخل الصفحة (playsInline) — بلا ذلك يفتحه iOS
            بمشغّلٍ ملء الشاشة فوق الموقع. والصورة غلافُه (poster) فتظهر فوراً
            ريثما يُحمّل، ويبقى شيءٌ إن تعذّر تشغيله. */}
        {/* صورةٌ حقيقية لا خلفيةَ CSS: خلفيةُ CSS يكتشفها المتصفّح متأخّراً —
            لا يراها ماسحُ التحميل المسبق بالـHTML، ولا تبدأ إلا بعد أن تُرسم
            العقدة ويُحسب نمطها، أي بعد الحزمة كلّها. و<img> يراه الماسح ويقبل
            fetchpriority فيتقدّم طابور التحميل. */}
        {hero.image && !hero.video && (
          <img
            className="bz-hero-img"
            src={heroSrc(hero.image)}
            srcSet={heroSrcSet(hero.image)}
            sizes="100vw"
            alt=""
            aria-hidden="true"
            fetchpriority="high"
            decoding="async"
          />
        )}
        {hero.video && (
          <video
            className="bz-hero-img bz-hero-video"
            src={hero.video}
            poster={hero.image || undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
          />
        )}
        <div className="bz-hero-veil" aria-hidden="true" />
        <span className="bz-hero-glow bz-hero-glow-a" aria-hidden="true" />
        <span className="bz-hero-glow bz-hero-glow-b" aria-hidden="true" />

        {/* شريط علويّ ثابت: يبدأ شفّافاً فوق الهيرو، ويلبس خلفيةً ضبابية
            بمجرّد النزول فيبقى مقروءاً فوق أي قسم. الأزرار الثلاثة حاضرة
            هنا أيضاً — لا يحتاج الزائر أن يعود للأعلى ليجد مدخلاً. */}
        <nav className={`bz-nav ${scrolled ? 'bz-nav-on' : ''}`}>
          <Link to="/" className="bz-nav-brand" aria-label={t('app.name')}>
            <Logo className="h-9 w-9" />
            <span className="bz-nav-name">{t('app.name')}</span>
          </Link>
          <div className="bz-nav-side">
            <Link to="/shop" className="bz-nav-link bz-nav-link-sm">{t('landing.shopNow')}</Link>
            <Link to="/login" className="bz-nav-link bz-nav-link-sm">{t('nav.login')}</Link>
            <Link to="/register" className="bz-nav-cta">
              <StoreIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('landing.openStore')}</span>
              <span className="sm:hidden">{t('landing.openStoreShort')}</span>
            </Link>
            <LanguageSwitcher />
            {/* ☰ — أقسام الصفحة كاملةً. على الجوّال هي المدخل الوحيد لها،
                وعلى الكمبيوتر تختصر النزول الطويل. */}
            <button
              type="button"
              onClick={() => setMenu(true)}
              aria-label={t('landing.menu')}
              aria-expanded={menu}
              className="bz-nav-burger app-tap"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          </div>
        </nav>

        {/* القائمة الكاملة — تغطّي الشاشة بخلفية المنصّة، لا لوحاً أبيض
            دخيلاً. روابطها أقسامُ الصفحة نفسها ثمّ الأفعال الثلاثة. */}
        {menu && (
          <div className="bz-menu" role="dialog" aria-modal="true">
            <div className="bz-menu-top">
              <button type="button" onClick={() => setMenu(false)} aria-label={t('common.close')} className="bz-nav-burger app-tap">
                <XIcon className="h-5 w-5" />
              </button>
              <span className="bz-nav-brand">
                <Logo className="h-9 w-9" />
                <span className="bz-nav-name">{t('app.name')}</span>
              </span>
            </div>

            <nav className="bz-menu-links">
              {/* تسميات قصيرة: كانت عناوين الأقسام كاملةً («كل ما يحتاجه
                  متجرك، جاهزاً») — جملةٌ لا تصلح بنداً بقائمة. */}
              {[
                !hidden.has('features') && ['features', t('landing.navFeatures')],
                !hidden.has('steps') && ['steps', t('landing.navSteps')],
                !hidden.has('testimonials') && testimonials.length > 0 && ['quotes', t('landing.navQuotes')],
                !hidden.has('faq') && faq.length > 0 && ['faq', t('landing.faqTitle')],
                ['about', t('landing.navAbout')],
                ['contact', t('landing.navContact')],
              ].filter(Boolean).map(([id, label], i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => goTo(id)}
                  className="bz-menu-link bz-in"
                  style={{ animationDelay: `${60 + i * 60}ms` }}
                >
                  <span className="bz-menu-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="bz-menu-lbl">{label}</span>
                  <ForwardIcon className="bz-menu-arrow h-4 w-4" />
                </button>
              ))}
            </nav>

            <div className="bz-menu-foot bz-in" style={{ animationDelay: '380ms' }}>
              <Actions t={t} compact labels={acts} />
              {/* سطرٌ أخير للأفعال الصغيرة: اللغة وسياسة الخصوصية — كانتا
                  تُطلبان من الفوتر وحده، وهو على بُعد صفحةٍ كاملة من هنا. */}
              <div className="bz-menu-meta">
                <button
                  type="button"
                  onClick={() => switchLanguage(en ? 'ar' : 'en')}
                  className="bz-menu-lang app-tap"
                  title="عربي / English"
                >
                  <b>{en ? 'AR' : 'EN'}</b> {en ? 'العربية' : 'English'}
                </button>
                <Link to="/privacy" onClick={() => setMenu(false)} className="bz-menu-mini">
                  <ShieldIcon className="h-3.5 w-3.5" /> {t('landing.privacy')}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* الهيرو تحريريّ لا متمركز: كتلة النصّ على حافّة البداية فوق الصورة —
            العين تقرأ سطراً واحداً متّصلاً بدل أن تقفز يميناً ويساراً، والصورة
            تبقى ظاهرةً بالجهة الأخرى بدل أن يغطّيها النصّ. */}
        <div className="bz-hero-body">
          {/* دخولٌ متتابع لعناصر الهيرو — نفس إحساس بطاقات المتاجر: كلٌّ
              يصعد ويتّضح بعد سابقه بلحظة، فتُقرأ الشاشة سطراً سطراً بدل أن
              تظهر دفعةً واحدة. */}
          <div className="bz-hero-block">
            <p className="bz-badge bz-in" style={{ animationDelay: '60ms' }}>{pick(hero, 'badge', t('landing.badge'))}</p>

            <h1 className="bz-h1 bz-in" style={{ animationDelay: '160ms' }}>{pick(hero, 'title', t('landing.title'))}</h1>

            <p className="bz-hero-sub bz-in" style={{ animationDelay: '280ms' }}>{pick(hero, 'subtitle', t('landing.subtitle'))}</p>

            {/* صفّ الميزات بعلامات صحّ — سطرٌ واحد على الشاشات الواسعة */}
            <div className="bz-ticks bz-in" style={{ animationDelay: '380ms' }}>
              {chips.slice(0, 4).map((c, i) => {
                const label = (en ? c.labelEn : c.label) || c.label || c.labelEn;
                return label ? (
                  <span key={label} className="bz-tick">
                    <span className="bz-tick-b"><CheckIcon className="h-3 w-3" /></span>{label}
                  </span>
                ) : null;
              })}
            </div>

            <div className="bz-hero-actions bz-in" style={{ animationDelay: '470ms' }}><Actions t={t} labels={acts} /></div>
          </div>
        </div>

        {/* «اعرف أكثر ↓» — يقول للزائر إنّ تحته صفحةً كاملة، ويأخذه إليها
            بضغطة بدل أن يبحث عن التمرير. */}
        <button type="button" onClick={() => goTo('features')} className="bz-more bz-in" style={{ animationDelay: '640ms' }}>
          {t('landing.more')} <ArrowDownIcon className="h-4 w-4" />
        </button>

        {/* أرقام حيّة من قاعدة البيانات — لا أرقام مكتوبة باليد.
            لكنّ الرقم الحيّ يعمل ضدّنا ما دام صغيراً: تاجرةٌ تتردّد في فتح
            متجرها ثمّ ترى «٢ متجر» تستنتج أنّ المكان خالٍ — فيصير ما وُضع
            دليلاً دليلاً معاكساً. فلا يظهر رقمٌ إلا حين يخدم، ولا يظهر الشريط
            إلا إن نجا منه اثنان على الأقلّ؛ وإلّا فلا شريط، وهو أنظفُ من شريطٍ
            يعترف بالقلّة. (العتبات اجتهادٌ لا قاعدة — تُغيَّر من هنا.) */}
        {!hidden.has('stats') && stats && shownStats.length >= 2 && (
          <div className="bz-stats">
            {shownStats.map(({ n, label, Icon }, i) => (
              <div key={label} className="bz-stat bz-in" style={{ animationDelay: `${580 + i * 90}ms` }}>
                <Icon className="bz-stat-ico h-5 w-5" />
                <span className="bz-stat-n"><CountUp value={n} />{n >= 50 ? '+' : ''}</span>
                <span className="bz-stat-l">{label}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* ─────────── الرفّ: قطعٌ حقيقيّة قبل أيّ شرح ───────────
          تُرى البضاعة أوّلاً: منصّةُ أزياءٍ تشرح نفسها بالنصّ قبل أن تُري
          قطعةً تطلب من الزائرة ثقةً لم تكسبها بعد. والقسمُ يُخفي نفسه إن لم
          يجد أربع قطعٍ بصور. */}
      {!hidden.has('shelf') && (
        <LandingShelf
          heading={{
            eyebrow: sec('shelf', 'eyebrow', 'landing.shelfEyebrow'),
            title: sec('shelf', 'title', 'landing.shelfTitle'),
            desc: sec('shelf', 'desc', 'landing.shelfDesc'),
          }}
        />
      )}

      {/* ─────────── ما تحصلين عليه ───────────
          الصفحة كانت تبيع متجراً ولا تُري متجراً: إحدى عشرة صورةً كلُّها قطعُ
          ملابس، ولا لقطةَ واحدة لما تشتريه التاجرة. وهذا أوّلُ ما تعرضه مواقعُ
          بناء المتاجر — لأنّ المشتري يشتري الواجهة لا وصفَها.
          واللقطة من متجرٍ حقيقيّ على المنصّة، لا رسمٌ متخيَّل. */}
      {!hidden.has('preview') && (
        <section id="preview" className="bz-sec bz-sec-alt bz-grain">
          <Reveal>
            <SectionTitle
              eyebrow={sec('preview', 'eyebrow', 'landing.seeEyebrow')}
              title={sec('preview', 'title', 'landing.seeTitle')}
              desc={sec('preview', 'desc', 'landing.seeDesc')}
            />
          </Reveal>
          <Reveal delay={120}>
            <div className="bz-phone">
              <div className="bz-phone-body">
                <span className="bz-phone-notch" aria-hidden="true" />
                <span className="bz-phone-side" aria-hidden="true" />
                <div className="bz-phone-screen">
                  {/* شريطُ الحالة: ساعةٌ ومؤشّرات. بدونه كانت الجزيرةُ تجلس
                      فوق اسم المتجر فتغطّيه — وهذا لا يقع بهاتفٍ حقيقيّ. */}
                  <div className="bz-phone-status" aria-hidden="true">
                    <span>9:41</span>
                    <span className="flex items-center gap-[3px]">
                      {/* إشارة · واي فاي · بطارية */}
                      <svg viewBox="0 0 18 12" width="13" height="9" fill="currentColor">
                        <rect x="0" y="8.5" width="3" height="3.5" rx="1" />
                        <rect x="4.5" y="6" width="3" height="6" rx="1" />
                        <rect x="9" y="3" width="3" height="9" rx="1" />
                        <rect x="13.5" y="0" width="3" height="12" rx="1" opacity="0.35" />
                      </svg>
                      <svg viewBox="0 0 16 12" width="12" height="9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M1 4.2a10 10 0 0 1 14 0" />
                        <path d="M3.6 7a6.4 6.4 0 0 1 8.8 0" />
                        <circle cx="8" cy="10" r="0.9" fill="currentColor" stroke="none" />
                      </svg>
                      <svg viewBox="0 0 26 12" width="18" height="9" fill="none">
                        <rect x="0.6" y="0.6" width="21" height="10.8" rx="3" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
                        <rect x="2.2" y="2.2" width="15" height="7.6" rx="1.8" fill="currentColor" />
                        <path d="M23.4 4.2v3.6a2 2 0 0 0 0-3.6Z" fill="currentColor" opacity="0.5" />
                      </svg>
                    </span>
                  </div>
                  <img
                    src="/store-preview.webp"
                    alt={t('landing.seeTitle')}
                    loading="lazy"
                    decoding="async"
                    width={540}
                    height={1170}
                  />
                </div>
              </div>
            </div>
          </Reveal>
          <div className="mt-9 text-center">
            <Link to="/shop" className="bz-btn-gold !inline-flex !w-auto px-8">
              {t('landing.seeCta')} <ForwardIcon className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ─────────── الميزات ─────────── */}
      {!hidden.has('features') && features.length > 0 && (
        <section id="features" className="bz-sec bz-sec-light">
          <Reveal><SectionTitle eyebrow={sec('features', 'eyebrow', 'landing.featEyebrow')} title={sec('features', 'title', 'landing.featTitle')} desc={sec('features', 'desc', 'landing.featDesc')} /></Reveal>
          {/* بنتو لا شبكة متساوية: الأولى تأخذ عمودين وتكبر، والباقيات أصغر.
              ثمانية مربّعات متطابقة تُقرأ كجدولٍ فتُتخطّى دفعةً واحدة؛ اختلاف
              الأحجام يعطي العين مدخلاً وترتيباً. */}
          <div className="bz-bento mt-10">
            {/* سبع لا ثمان: الأولى تشغل خانتين، فيمتلئ الصفّان تماماً بلا بطاقةٍ
                يتيمة بسطرٍ وحدها. */}
            {features.slice(0, 3).map((f, i) => {
              const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
              return (
                <Reveal key={pick(f, 'title', i)} delay={i * 55} className={i === 0 ? 'bz-bento-lg' : ''}>
                  <article className={`bz-card ${i === 0 ? 'bz-card-lg' : ''}`}>
                    <span className="bz-card-ico"><Icon className={i === 0 ? 'h-7 w-7' : 'h-6 w-6'} /></span>
                    <h3 className="bz-card-t">{pick(f, 'title', '')}</h3>
                    <p className="bz-card-d">{pick(f, 'desc', '')}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>

          {/* الباقيات صفٌّ مضغوط: اسمٌ وأيقونة بلا شرح.
              سبعُ بطاقاتٍ كاملة كانت تصنع ٢٩٪ من الصفحة — ضِعفَ أيّ قسمٍ آخر،
              وشرحُ الميزة السابعة لا يُقرأ بعد الشرح السادس. الثلاثُ الأولى
              تُقنع، والباقياتُ تُطمئن أنّ ما تحتاجه موجود. */}
          {features.length > 3 && (
            <Reveal delay={220}>
              <ul className="bz-featlist">
                {features.slice(3, 8).map((f, i) => {
                  const Icon = FEATURE_ICONS[(i + 3) % FEATURE_ICONS.length];
                  return (
                    <li key={pick(f, 'title', i)} className="bz-featlist-i">
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span>{pick(f, 'title', '')}</span>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          )}
        </section>
      )}

      {/* ─────────── الخطوات ─────────── */}
      {!hidden.has('steps') && steps.length > 0 && (
        <section id="steps" className="bz-sec bz-sec-alt bz-grain">
          <Reveal><SectionTitle eyebrow={sec('steps', 'eyebrow', 'landing.stepEyebrow')} title={sec('steps', 'title', 'landing.stepTitle')} desc={sec('steps', 'desc', 'landing.stepDesc')} /></Reveal>
          {/* خطٌّ ذهبيّ يصل الخطوات فتُقرأ كمسار، لا ثلاث بطاقات متجاورة
              لا رابط بينها. الرقم على الخطّ نفسه — هو العُقدة. */}
          <ol className="bz-path mt-12">
            {steps.slice(0, 4).map((s, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              return (
                <Reveal key={pick(s, 'title', i)} delay={i * 110}>
                  <li className="bz-node">
                    <span className="bz-node-dot">
                      <Icon className="h-5 w-5" />
                      <b>{i + 1}</b>
                    </span>
                    <h3 className="bz-node-t">{pick(s, 'title', '')}</h3>
                    <p className="bz-node-d">{pick(s, 'desc', '')}</p>
                  </li>
                </Reveal>
              );
            })}
          </ol>
          <Reveal delay={200}>
            <div className="mt-9 flex justify-center">
              <Link to="/register" className="bz-btn-gold sm:!w-auto sm:!px-9">
                <StoreIcon className="h-5 w-5" /> {t('landing.openStore')}
              </Link>
            </div>
          </Reveal>
        </section>
      )}

      {/* ─────────── شهادات ─────────── */}
      {!hidden.has('testimonials') && testimonials.length > 0 && (
        <section id="quotes" className="bz-sec bz-sec-light">
          <Reveal><SectionTitle eyebrow={sec('quotes', 'eyebrow', 'landing.tstEyebrow')} title={sec('quotes', 'title', 'landing.tstTitle')} desc={sec('quotes', 'desc', '')} /></Reveal>
          {/* الأولى كبيرة تُقرأ، والباقيات إلى جانبها — بدل ثلاثٍ متساوية
              لا تُقرأ منها واحدة. */}
          <div className="bz-quotes mt-10">
            {testimonials.slice(0, 6).map((q, i) => (
              <Reveal key={(q.name || '') + i} delay={i * 70} className={i === 0 ? 'bz-quote-lead' : ''}>
                <figure className={`bz-quote ${i === 0 ? 'bz-quote-big' : ''}`}>
                  <span className="bz-quote-mark" aria-hidden="true">”</span>
                  <blockquote className="bz-quote-t">{(en ? q.textEn : q.text) || q.text || q.textEn}</blockquote>
                  <figcaption className="bz-quote-by">
                    <span className="bz-quote-av">
                      {q.image ? <img src={q.image} alt="" /> : <CrownIcon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{pick(q, 'name', '')}</span>
                      {pick(q, 'store', '') && <span className="block truncate text-[11.5px] opacity-70">{pick(q, 'store', '')}</span>}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ─────────── الأسئلة ───────────
          تقوم مقامَ الشهادات بالمسار نفسه: كلاهما يزيل التردّد قبل التسجيل.
          لكنّ الشهادة تقول «غيري جرّب فارتاح»، والجواب يقول «هذا ما ستدفعينه
          وهذا ما سيحدث» — وهذا يصحّ بمنصّةٍ عمرها شهور، وذاك لا يصحّ بعد. */}
      {!hidden.has('faq') && faq.length > 0 && (
        <section id="faq" className="bz-sec bz-sec-light">
          <Reveal>
            <SectionTitle
              eyebrow={sec('faq', 'eyebrow', 'landing.faqEyebrow')}
              title={sec('faq', 'title', 'landing.faqTitle')}
              desc={sec('faq', 'desc', 'landing.faqDesc')}
            />
          </Reveal>
          <div className="bz-faq mt-10">
            {faq.slice(0, 8).map((item, i) => (
              <Reveal key={pick(item, 'q', i)} delay={i * 55}>
                <details className="bz-faq-i">
                  <summary className="bz-faq-q">
                    <span>{pick(item, 'q', '')}</span>
                    <span className="bz-faq-sign" aria-hidden="true" />
                  </summary>
                  <p className="bz-faq-a">{pick(item, 'a', '')}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ─────────── الختام: الأزرار الثلاثة مرّةً أخرى ─────────── */}
      <section id="cta" className="bz-cta bz-grain">
        <span className="bz-hero-glow bz-hero-glow-a" aria-hidden="true" />
        <Reveal>
          <div className="relative mx-auto max-w-2xl text-center">
            <span className="bz-cta-ico"><UsersIcon className="h-7 w-7" /></span>
            <h2 className="bz-h2 mt-5">{pick(L.cta || {}, 'title', t('landing.ctaTitle'))}</h2>
            <p className="bz-lead mx-auto mt-3">{pick(L.cta || {}, 'subtitle', t('landing.ctaDesc'))}</p>
            <div className="mt-8"><Actions t={t} labels={acts} /></div>
            {BAZARA_WHATSAPP && (
              <a href={buildWhatsappLink(BAZARA_WHATSAPP)} target="_blank" rel="noreferrer" className="bz-cta-wa">
                <WhatsAppIcon className="h-4 w-4" /> {t('landing.askUs')}
              </a>
            )}
          </div>
        </Reveal>
      </section>

      {/* ─────────── من نحن · تواصلوا معنا ───────────
          الزائر الجادّ يسأل مَن خلف المنصّة وكيف يصل إليها قبل أن يسلّمها
          متجره. غياب هذا وحده يجعل الموقع يبدو مؤقّتاً. */}
      <footer className="bz-foot bz-grain">
        <div className="bz-foot-grid">
          <Reveal id="about">
            <div className="bz-foot-col">
              <h3 className="bz-foot-h">{pick(L_.about || {}, 'title', t('landing.aboutTitle'))}</h3>
              <p className="bz-foot-p">{pick(L_.about || {}, 'text', t('landing.aboutText'))}</p>
              <Link to="/register" className="bz-foot-cta">
                <StoreIcon className="h-4 w-4" /> {t('landing.openStore')}
              </Link>
            </div>
          </Reveal>

          <Reveal delay={90} id="contact">
            <div className="bz-foot-col">
              <h3 className="bz-foot-h">{pick(L_.contact || {}, 'title', t('landing.contactTitle'))}</h3>
              <ul className="bz-foot-list">
                {BAZARA_WHATSAPP && (
                  <li><a href={buildWhatsappLink(BAZARA_WHATSAPP)} target="_blank" rel="noreferrer">
                    <WhatsAppIcon className="h-4 w-4" /> {t('landing.whatsapp')}
                  </a></li>
                )}
                {contact.email && (
                  <li><a href={`mailto:${contact.email}`} dir="ltr"><MailIcon className="h-4 w-4" /> {contact.email}</a></li>
                )}
                {contact.phone && (
                  <li><a href={`tel:${contact.phone}`} dir="ltr"><PhoneIcon className="h-4 w-4" /> {contact.phone}</a></li>
                )}
                {(pick(contact, 'address', '')) && (
                  <li><span><PinIcon className="h-4 w-4" /> {pick(contact, 'address', '')}</span></li>
                )}
                {(pick(contact, 'hours', '')) && (
                  <li><span><ClockIcon className="h-4 w-4" /> {pick(contact, 'hours', '')}</span></li>
                )}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={170}>
            <div className="bz-foot-col">
              <h3 className="bz-foot-h">{t('landing.linksTitle')}</h3>
              <ul className="bz-foot-list">
                <li><Link to="/shop"><BagIcon className="h-4 w-4" /> {t('landing.shopNow')}</Link></li>
                <li><Link to="/login"><UsersIcon className="h-4 w-4" /> {t('nav.login')}</Link></li>
                <li><Link to="/register"><StoreIcon className="h-4 w-4" /> {t('landing.openStore')}</Link></li>
                <li><Link to="/privacy"><ShieldIcon className="h-4 w-4" /> {t('landing.privacy')}</Link></li>
              </ul>
            </div>
          </Reveal>
        </div>

        <div className="bz-foot-bar">
          <span>© {new Date().getFullYear()} {t('app.name')} — {t('footer.rights')}</span>
          {/* العودة للأعلى هنا لا كزرٍّ عائم يطبق على النصّ */}
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="bz-foot-top">
            {t('landing.toTop')} <ArrowUpIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
