import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { openSocial, socialWebUrl } from '../utils/social.js';
import { Link, useLocation } from 'react-router-dom';
import api from '../api/client.js';
import Navbar from './Navbar.jsx';
import { lazy, Suspense } from 'react';
import { useCart } from '../context/CartContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { retryImport } from '../utils/chunkReload.js';

// الدرجان يُحمَّلان عند فتحهما لا قبله.
//
// كانا مستوردَين بالهيكل الدائم، وكلاهما يستعمل framer-motion — فكانت المكتبة
// تدخل المسار الحرج لكلّ زائرة، ومن لم تفتح درجاً قطّ تدفع ثمنها كاملاً.
// وكلُّ آثارهما محروسةٌ أصلاً بحالة الفتح (فحصتُها أثراً أثراً: ما ليس محروساً
// بـopen محروسٌ بـview أو بقائمةٍ لا تمتلئ إلا بعد الفتح)، فتأجيلُ التركيب
// مكافئٌ سلوكياً.
const CartDrawer = lazy(() => retryImport(() => import('./CartDrawer.jsx')));
const WishlistDrawer = lazy(() => retryImport(() => import('./WishlistDrawer.jsx')));
import CartReminder from './CartReminder.jsx';
import OfflineBanner from './OfflineBanner.jsx';
import BottomNav from './BottomNav.jsx';
import ScrollToTopButton from './ScrollToTopButton.jsx';
import PullToRefresh from './PullToRefresh.jsx';
import SwipeBack from './SwipeBack.jsx';
import { isStandalone } from '../utils/pwa.js';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { WhatsAppIcon, InstagramIcon, FacebookIcon } from './icons.jsx';
import { BAZARA_WHATSAPP, BAZARA_INSTAGRAM, BAZARA_FACEBOOK } from '../config/site.js';
import { setPlatformCategories } from '../utils/platformCategories.js';
import ImpersonationBar from './ImpersonationBar.jsx';
import { isImpersonating } from '../utils/impersonation.js';

// الهوية الخمرية/العاجية الفاخرة مطبّقة على كل الموقع (متجر عام + لوحة تحكم لكل المشتركين).
export default function Layout({ children }) {
  const { pathname, search } = useLocation();
  // حالةُ فتح الدرجين تُقرأ هنا كي نؤجّل تركيبهما حتى تُفتح فعلاً
  const { open: cartOpen } = useCart();
  const { open: wishOpen } = useWishlist();
  // صفحات المتجر العامة لها هيدر وفوتر خاص بالمتجر بدل شريط/فوتر Bazara العام
  const isStorePage = /^\/store\//.test(pathname);
  // صفحة المنتج تلبس هوية متجرها (StoreHeader/StoreFooter داخلها) — فنخفي شريط بازارا.
  const isProduct = /^\/product\//.test(pathname);
  // البحث/التتبّع بنطاق متجر (?store=slug): نخفي شريط بازارا كي لا يظهر اسمه/درج التحكم داخل المتجر
  const storeParam = Boolean(new URLSearchParams(search).get('store'));
  const isStoreSearch = pathname === '/search' && storeParam;
  const isStoreTrack = pathname === '/track' && storeParam;
  // شاشة افتتاح التطبيق المثبّت (الجذر) — بلا شريط/فوتر ليبدو كتطبيق كامل
  // صفحة المنصّة (الجذر بالمتصفّح): شريطها وفوترها من داخلها، فتُخفى قشرة
  // الموقع كاملةً — كانت تُخفى للتطبيق المثبّت وحده.
  const isLanding = pathname === '/';
  // صفحات المستندات (الخصوصية وما شابهها) تحمل شريط صفحة المنصّة بنفسها —
  // شريطُ التسوّق بسلّته ومفضّلته لا معنى له بصفحةٍ تُفتح من الفوتر.
  const isDoc = pathname === '/privacy';
  // صفحات الحساب — تصميم بملء الشاشة (هيرو + نموذج) بلا شريط/فوتر
  const isAuthFull = ['/login', '/register', '/forgot-password', '/reset'].includes(pathname);
  // الريلز = ملء الشاشة (كتيك توك) — الهيدر كان يظهر فوقها ويغطي المحتوى
  const isReels = pathname === '/reels';
  const hideChrome = isStorePage || isProduct || isStoreSearch || isStoreTrack || isLanding || isDoc || isAuthFull || isReels;
  // لوحة التحكم/الاشتراك: لها شريط وتنقّل عام لكن بلا فوتر المنصّة التسويقي (سياق إدارة لا تسوّق)
  const isDashboard = /^\/dashboard/.test(pathname) || pathname === '/subscribe';
  const showFooter = !hideChrome && !isDashboard;
  // شريط التنقّل السفلي يظهر داخل التطبيق المثبّت على كل الصفحات (بما فيها المتجر) عدا الترحيب/الدخول
  // الشريط السفلي يظهر على كل الأجهزة (جوال/آيباد/كمبيوتر) عدا شاشات الترحيب/الدخول
  // صفحات المستندات بلا شريطٍ سفليّ: تسوّق وسلّة وطلبات بصفحةٍ نصّية
  // تُقرأ ثم يُغادَر منها — الشريط يقتطع مساحةً ولا يُستعمل.
  const showBottomNav = !isLanding && !isAuthFull && !isDoc;

  // إغلاق لوحة المفاتيح فور بدء التمرير (سحب الشاشة) — يمنع تعليق الشاشة والقفز
  // أثناء فتح أي شريط بحث، ويعطي إحساس التطبيقات الأصلية. يطبَّق على كل الموقع.
  useEffect(() => {
    const dismiss = () => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') &&
          !['button', 'submit', 'checkbox', 'radio', 'range', 'file', 'color', 'image'].includes(el.type)) {
        el.blur();
      }
    };
    window.addEventListener('touchmove', dismiss, { passive: true });
    window.addEventListener('wheel', dismiss, { passive: true });
    return () => { window.removeEventListener('touchmove', dismiss); window.removeEventListener('wheel', dismiss); };
  }, []);

  // صنف على body يدفع كل الصفحة تحت شريط الجلسة النيابية — لو تركناه ثابتاً
  // فوق المحتوى وحده لغطّى الهيدر بكل صفحة.
  useEffect(() => {
    const on = isImpersonating();
    document.body.classList.toggle('bz-impersonating', on);
    return () => document.body.classList.remove('bz-impersonating');
  }, []);

  return (
    <div className="app-bg theme-pub flex min-h-screen flex-col">
      <ImpersonationBar />
      <PullToRefresh />
      {/* سحب من الحافة للرجوع (التطبيق المثبّت فقط) — إحساس أصلي كإنستغرام/iOS */}
      <SwipeBack />
      {/* الشريطُ قبل الهيدر بالمستند: كلاهما ملتصقٌ بالأعلى، والمرسومُ
          لاحقاً يعلو سابقَه — فكان يغطّي حقلَ البحث. وبـfixed على الجوّال
          يخرج من التدفّق فلا يفرق موضعُه بالشيفرة. */}
      {showBottomNav && <BottomNav />}
      {!hideChrome && <Navbar />}
      {/* عرض المحتوى ينمو مع الشاشة: كان محبوساً عند 1152px دائماً، فعلى شاشة 1920
          يبقى 384px فارغاً من كل جهة (٤٠٪ من العرض) وعلى آيباد أفقي 107px. نوسّعه
          تدريجياً مع الحفاظ على سطر قراءة معقول (لا نمدّه لكامل العرض). */}
      {/* فوتر المنصّة يظهر على كل صفحات المتجر العام (زي فوتر المتاجر) — مع الشريط
          السفلي أيضاً. عند ظهوره يحمل هو مسافة الشريط السفلي، فلا يبقى فراغ كبير
          داخل main قبله ولا يغطّيه الشريط. */}
      {/* صفحة تتبّع المتجر: نجعل main عموداً مرناً كي يملأ غلاف المسار الارتفاع
          (flex-1) فيلتصق فوتر المتجر بالأسفل بدل طفوه لأعلى — flex-grow لا نسبة % */}
      {/* صفحة المنصّة تملأ الشاشة من حافةٍ لحافة: غلاف المحتوى المحدود بعرضٍ
          وحشوةٍ جانبية كان يحبس هيروها فيظهر لون الخلفية على الجانبين، ويقصّ
          شريطها العلويّ. أقسامها تتولّى عرضها وحشوتها بنفسها. */}
      {isLanding || isAuthFull || isDoc ? (
        <main className="w-full flex-1">{children}</main>
      ) : (
        <main className={`mx-auto w-full max-w-6xl flex-1 px-4 pt-5 sm:px-6 xl:max-w-[1320px] 2xl:max-w-[1600px] ${isStoreTrack ? 'flex flex-col' : ''} ${showBottomNav && !showFooter ? 'pb-bottomnav' : 'pb-8'}`}>{children}</main>
      )}
      {showFooter && <PublicFooter bottomNav={showBottomNav} />}
      {cartOpen && <Suspense fallback={null}><CartDrawer /></Suspense>}
      {wishOpen && <Suspense fallback={null}><WishlistDrawer /></Suspense>}
      {/* لا نُظهر تذكير السلة على صفحات الحساب/الترحيب (يغطّي النموذج) */}
      {!isAuthFull && !isLanding && <CartReminder />}
      <OfflineBanner />
      {/* زر «العودة للأعلى» العائم بجهة البداية-الأسفل كان يطبق فوق زر الحفظ في نماذج
          لوحة التحكم الطويلة (سلايدر الموقع، إعدادات المتجر...) فيغطّيه. نخفيه في لوحة
          التحكم/الاشتراك — منطقة إدارة بهيكلها الخاص لا تحتاج زراً عائماً يزاحم الأزرار. */}
      {!isReels && !isDashboard && !isLanding && <ScrollToTopButton />}
    </div>
  );
}

function PublicFooter({ bottomNav = false }) {
  const { t } = useTranslation();
  // حسابات السوشيال يحرّرها المدير (لوحة الموقع) — نبدأ من كاش محلي فتظهر فوراً،
  // ثم نحدّثها بالخلفية من نقطة عامة خفيفة. الإعدادات الثابتة احتياط أخير.
  const [social, setSocial] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bz_site_socials') || 'null') || {}; } catch { return {}; }
  });
  useEffect(() => {
    api.get('/public/site-info')
      .then((r) => {
        // فئات المنصّة تصل مع معلومات الموقع — مصدر واحد يغذّي كل الواجهات
        setPlatformCategories(r.data?.platformCategories);
        const s = { instagram: r.data?.instagram || '', facebook: r.data?.facebook || '' };
        setSocial(s);
        try { localStorage.setItem('bz_site_socials', JSON.stringify(s)); } catch { /* تجاهل */ }
      })
      .catch(() => { /* الفوتر لا يكسر بلا سوشيال */ });
  }, []);
  const ig = social.instagram || BAZARA_INSTAGRAM;
  const fb = social.facebook || BAZARA_FACEBOOK;
  return (
    <footer className={`pub-footer mt-16 sm:mt-20 ${bottomNav ? 'pb-bottomnav' : ''}`}>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 text-center sm:px-6">
        <Link to="/" className="font-display text-2xl font-bold tracking-wide text-cream">
          {t('app.name')}
        </Link>
        <p className="mt-2 text-sm text-cream/70">{t('app.tagline')}</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          {[
            BAZARA_WHATSAPP && { label: 'WhatsApp', href: buildWhatsappLink(BAZARA_WHATSAPP), icon: <WhatsAppIcon className="h-5 w-5" /> },
            ig && { label: 'Instagram', kind: 'instagram', raw: ig, href: socialWebUrl('instagram', ig), icon: <InstagramIcon className="h-5 w-5" /> },
            fb && { label: 'Facebook', kind: 'facebook', raw: fb, href: socialWebUrl('facebook', fb), icon: <FacebookIcon className="h-5 w-5" /> },
          ]
            .filter(Boolean)
            .map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                onClick={(e) => s.kind && openSocial(s.kind, s.raw, e)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/25 text-cream/90 transition hover:bg-cream/10"
              >
                {s.icon}
              </a>
            ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-cream/80">
          <Link to="/track" className="hover:text-cream">{t('nav.track')}</Link>
          <span aria-hidden className="text-cream/60">•</span>
          <Link to="/wishlist" className="hover:text-cream">{t('nav.wishlist')}</Link>
          <span aria-hidden className="text-cream/60">•</span>
          <Link to="/" className="hover:text-cream">{t('nav.home')}</Link>
        </div>

        <div className="mx-auto mt-7 h-px max-w-md bg-cream/15" />
        <p className="mt-5 text-xs text-cream/60">
          © {new Date().getFullYear()} {t('app.name')} — {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}

