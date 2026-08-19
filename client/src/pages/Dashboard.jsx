import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../context/AuthContext.jsx';
import Seo from '../components/Seo.jsx';
import {
  UserIcon, DownloadIcon, HomeIcon, ChartIcon, GearIcon, BagIcon, ReceiptIcon,
  TicketIcon, GiftIcon, BellIcon, UsersIcon, ShieldIcon, ImageIcon, StoreIcon, LinkIcon, MailIcon, InstagramIcon, BoltIcon,
} from '../components/icons.jsx';
import SubscriptionBanner from '../components/SubscriptionBanner.jsx';
import { SectionHead, Tip } from '../components/FormField.jsx';
import Profile from './dashboard/Profile.jsx';
import StoreSettings from './dashboard/StoreSettings.jsx';
import ProductsManager from './dashboard/ProductsManager.jsx';
import OrdersManager from './dashboard/OrdersManager.jsx';
import CouponsManager from './dashboard/CouponsManager.jsx';
import ReferralsManager from './dashboard/ReferralsManager.jsx';
import AnalyticsManager from './dashboard/AnalyticsManager.jsx';
import AdminOverview from './dashboard/AdminOverview.jsx';
import BroadcastManager from './dashboard/BroadcastManager.jsx';
import CountUp from '../components/CountUp.jsx';
import StockRequestsManager from './dashboard/StockRequestsManager.jsx';
import AdminRequests from './dashboard/AdminRequests.jsx';
import SubscribersManager from './dashboard/SubscribersManager.jsx';
import SiteSliders from './dashboard/SiteSliders.jsx';
import NewsletterManager from './dashboard/NewsletterManager.jsx';
import InstagramInbox from './dashboard/InstagramInbox.jsx';
import CampaignManager from './dashboard/CampaignManager.jsx';

// أقسام البائع (المشترك العادي) — الاستخدام اليومي أولاً (الطلبات/المنتجات)
const SECTIONS = [
  { key: 'overview', Icon: HomeIcon },
  { key: 'myOrders', Icon: ReceiptIcon },
  { key: 'myProducts', Icon: BagIcon },
  { key: 'instagram', Icon: InstagramIcon },
  { key: 'analytics', Icon: ChartIcon },
  { key: 'coupons', Icon: TicketIcon },
  { key: 'referrals', Icon: GiftIcon },
  { key: 'campaign', Icon: BellIcon },
  { key: 'stockRequests', Icon: BellIcon },
  { key: 'storeSettings', Icon: GearIcon },
  { key: 'profile', Icon: UserIcon },
];

// أقسام المدير (تحكّم فقط — بلا بيع/منتجات)
const ADMIN_SECTIONS = [
  { key: 'adminOverview', Icon: ChartIcon },
  { key: 'subscribers', Icon: UsersIcon },
  { key: 'admin', Icon: ShieldIcon },
  { key: 'siteSliders', Icon: ImageIcon },
  { key: 'newsletter', Icon: MailIcon },
  { key: 'broadcast', Icon: MailIcon },
  { key: 'profile', Icon: UserIcon },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, store, subscription } = useAuth();
  const [params] = useSearchParams();
  const [productsCount, setProductsCount] = useState(null);
  const isAdmin = subscription?.isAdmin;
  // التنقّل بين الأقسام عبر قائمة ☰ (Navbar) — المصدر الوحيد بلا تكرار
  const allowed = (isAdmin ? ADMIN_SECTIONS : SECTIONS).map((s) => s.key);
  const defaultTab = isAdmin ? 'adminOverview' : 'overview';
  const raw = params.get('tab') || defaultTab;
  // المدير لا يصل لأقسام البيع حتى عبر الرابط
  const section = allowed.includes(raw) ? raw : defaultTab;

  const avatar = user?.avatarUrl ? (
    <img src={user.avatarUrl} alt={user.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-[#e6c878]/60" />
  ) : (
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F4EDE2]/10 text-xl font-bold text-[#e6c878] ring-2 ring-[#e6c878]/60">
      {user?.name?.[0] || <UserIcon className="h-6 w-6" />}
    </span>
  );

  return (
    <div className="dash mx-auto w-full max-w-4xl space-y-5">
      <Seo title={t('dashboard.title')} />

      {/* هيدر فاخر: تحية + اسم المتجر بخط العرض + زر معاينة المتجر */}
      <header className="dash-hero relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {avatar}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#d9c9a8]">
              {t('dashboard.hello')} {user?.name} 👋
            </p>
            {/* dir=auto: الاسم اللاتيني يأخذ اتجاهه الصحيح فلا يظهر القص (…) بأول الاسم */}
            <h1 dir="auto" className="mt-0.5 truncate font-display text-[1.35rem] font-extrabold leading-snug text-[#F4EDE2] sm:text-3xl">
              {isAdmin ? t('admin.nav') : (store?.name || t('dashboard.title'))}
            </h1>
          </div>
          {/* على الموبايل الزر يأخذ سطراً كاملاً لوحده — يترك عرض الشاشة لاسم المتجر */}
          {!isAdmin && store && (
            <Link
              to={`/store/${store.slug}`}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#e6c878]/40 bg-[#F4EDE2]/10 px-4 py-2 text-sm font-semibold text-[#F4EDE2] transition hover:bg-[#F4EDE2]/20 sm:w-auto"
            >
              <StoreIcon className="h-4 w-4" /> {t('dashboard.viewStore')}
            </Link>
          )}
        </div>
      </header>

      <div className="min-w-0">
        {section === 'overview' && !isAdmin && <Overview productsCount={productsCount} />}
        {section === 'analytics' && !isAdmin && <AnalyticsManager />}
        {section === 'profile' && <Profile />}
        {section === 'storeSettings' && !isAdmin && <StoreSettings />}
        {section === 'myProducts' && !isAdmin && <ProductsManager onCount={setProductsCount} />}
        {section === 'instagram' && !isAdmin && <InstagramInbox />}
        {section === 'myOrders' && !isAdmin && <OrdersManager />}
        {section === 'coupons' && !isAdmin && <CouponsManager />}
        {section === 'referrals' && !isAdmin && <ReferralsManager />}
        {section === 'campaign' && !isAdmin && <CampaignManager />}
        {section === 'stockRequests' && !isAdmin && <StockRequestsManager />}
        {section === 'adminOverview' && isAdmin && <AdminOverview />}
        {section === 'subscribers' && isAdmin && <SubscribersManager />}
        {section === 'admin' && isAdmin && <AdminRequests />}
        {section === 'siteSliders' && isAdmin && <SiteSliders />}
        {section === 'newsletter' && isAdmin && <NewsletterManager />}
        {section === 'broadcast' && isAdmin && <BroadcastManager />}
      </div>
    </div>
  );
}


function Overview({ productsCount }) {
  const { t } = useTranslation();
  const { store, subscription } = useAuth();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState(null);
  const qrRef = useRef(null);
  const publicUrl = store ? `${window.location.origin}/store/${store.slug}` : '';

  // نجلب العدّادات (منتجات/زوّار) مباشرةً كي تظهر بالنظرة العامة بلا فتح تبويب آخر
  useEffect(() => {
    api.get('/orders/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const productCount = stats?.productsCount ?? productsCount;
  const visitors = stats?.visitors;

  const copy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${store.slug}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const cur = t('common.currency');

  // نفس هيكل صفحة إعدادات المتجر: بطاقة قسم بخيط ذهبي + رأس ببلاطة أيقونة متدرّجة
  const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';

  return (
    <div className="space-y-5">
      {/* رأس الصفحة — بنفس نمط رأس الإعدادات (بلاطة متدرّجة + عنوان ذهبي + سطر تعريفي) */}
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-amber-500 text-white shadow-md">
          <HomeIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-tight gradient-text">{t('dashboard.overview')}</h1>
          <p className="text-xs text-stone-400">{t('dashboard.ovHint')}</p>
        </div>
      </div>

      <SubscriptionBanner />

      {/* المؤشّرات الرئيسية */}
      <div className={CARD}>
        <SectionHead icon={<ChartIcon className="h-5 w-5" />} title={t('dashboard.ovMetrics')} desc={t('dashboard.ovMetricsHint')} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label={t('dashboard.analytics.revenue')} tip={t('dashboard.ovRevenueTip')} value={stats ? <CountUp value={stats.revenue} format={(x) => `${cur}${Math.round(x).toLocaleString()}`} /> : '—'} Icon={WalletGlyph} grad="from-emerald-500 to-emerald-700" accent="text-emerald-400" />
          <MetricCard label={t('dashboard.analytics.newOrders')} tip={t('dashboard.ovNewOrdersTip')} value={stats ? <CountUp value={stats.newOrders} /> : '—'} Icon={ReceiptIcon} grad="from-gold-400 to-amber-500" accent="text-gold-300" />
          <MetricCard label={t('dashboard.visitors')} tip={t('dashboard.ovVisitorsTip')} value={visitors != null ? <CountUp value={visitors} /> : '—'} Icon={UsersIcon} grad="from-[#8a6a4f] to-[#3f2e22]" accent="text-stone-100" />
          <MetricCard label={t('dashboard.productsCount')} tip={t('dashboard.ovProductsTip')} value={productCount != null ? <CountUp value={productCount} /> : '—'} Icon={BagIcon} grad="from-wine to-wine-dark" accent="text-stone-100" />
        </div>
      </div>

      {/* تنبيه طلبات التوفّر — يظهر فقط عند وجود ما يستدعي التصرّف. الأخضر (رجع متوفّر
          وجاهز للتنبيه) أولوية على الرمادي (لسه ينتظرون) — بضغطة يفتح تبويب الطلبات */}
      {(stats?.stockRequestsReady > 0 || stats?.stockRequestsPending > 0) && (
        <Link
          to="/dashboard?tab=stockRequests"
          className={`group flex items-center gap-3 rounded-2xl p-4 ring-1 transition hover:-translate-y-0.5 ${
            stats.stockRequestsReady > 0
              ? 'bg-emerald-500/10 ring-emerald-400/30'
              : 'bg-white/5 ring-white/10'
          }`}
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md ${stats.stockRequestsReady > 0 ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-[#8a6a4f] to-[#3f2e22]'}`}>
            <BellIcon className="h-[22px] w-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${stats.stockRequestsReady > 0 ? 'text-emerald-200' : 'text-stone-200'}`}>
              {stats.stockRequestsReady > 0
                ? t('dashboard.stockRequests.overviewReady', { count: stats.stockRequestsReady })
                : t('dashboard.stockRequests.overviewPending', { count: stats.stockRequestsPending })}
            </p>
            <p className="mt-0.5 truncate text-xs text-stone-400">{t('dashboard.stockRequests.overviewCta')}</p>
          </div>
        </Link>
      )}

      {/* إجراءات سريعة — اختصارات لأكثر ما يستخدمه صاحب المتجر يومياً */}
      <div className={CARD}>
        <SectionHead icon={<BoltIcon className="h-5 w-5" />} title={t('dashboard.quickActions')} desc={t('dashboard.ovQuickHint')} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction to="/dashboard?tab=myProducts" label={t('dashboard.myProducts')} Icon={BagIcon} />
          <QuickAction to="/dashboard?tab=myOrders" label={t('dashboard.myOrders')} Icon={ReceiptIcon} />
          <QuickAction to="/dashboard?tab=analytics" label={t('dashboard.analytics.title')} Icon={ChartIcon} />
          <QuickAction to="/dashboard?tab=storeSettings" label={t('dashboard.storeSettings')} Icon={GearIcon} />
        </div>
      </div>

      {/* شارك متجرك: الرابط + رمز QR في بطاقة واحدة متناسقة (بدل بطاقتين منفصلتين) */}
      {store && (
        <div className={CARD}>
          <SectionHead icon={<LinkIcon className="h-5 w-5" />} title={t('dashboard.store.shareStore')} desc={t('dashboard.ovShareHint')} />
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch">
            {/* رمز QR */}
            <div className="flex flex-col items-center gap-2">
              <div ref={qrRef} className="rounded-2xl bg-white p-3 shadow-lg ring-1 ring-gold-400/30">
                <QRCodeCanvas value={publicUrl} size={132} level="M" includeMargin={false} />
              </div>
              <button onClick={downloadQr} className="btn-ghost gap-1.5 !py-1.5 text-xs">
                <DownloadIcon className="h-3.5 w-3.5" /> {t('qr.download')}
              </button>
            </div>
            {/* الرابط + الكود */}
            <div className="flex w-full min-w-0 flex-1 flex-col justify-center gap-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-stone-400">{t('dashboard.store.publicLink')}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 truncate rounded-xl bg-black/30 px-4 py-2.5 text-sm text-gold-200 ring-1 ring-white/5" dir="ltr">
                    {publicUrl}
                  </code>
                  <button onClick={copy} className="btn-primary shrink-0 !py-2.5 text-sm">
                    {copied ? t('common.copied') : t('common.copyLink')}
                  </button>
                </div>
              </div>
              {subscription?.subscriberCode && (
                <div className="rounded-xl bg-gold-400/5 px-4 py-2.5 ring-1 ring-gold-400/15">
                  <span className="text-xs text-stone-400">{t('subscription.subscriberCode')}: </span>
                  <span className="font-mono text-sm font-bold text-gold-300" dir="ltr">{subscription.subscriberCode}</span>
                </div>
              )}
              <p className="text-xs text-stone-500">{t('qr.hint')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// بطاقة مؤشّر موحّدة — بلاطة أيقونة متدرّجة + رقم بارز (نفس لغة صفحة الإحصائيات).
// (أُزيل التوهّج الزخرفي المتدرّج: كان يتسرّب خارج زاوية البطاقة على iOS لأن
// overflow-hidden لا يقصّ عنصر البلور هناك، فيظهر مربّع باهت مقزّز بالزاوية.)
// (صارت بطاقة فرعية داخل قسم لا بطاقة زجاجية مستقلّة — نفس نمط البطاقات الفرعية
//  بصفحة الإعدادات، فلا تتداخل طبقتا زجاج ويبقى الإيقاع البصري واحداً.)
function MetricCard({ label, value, Icon, grad, accent, tip }) {
  return (
    <div className="rounded-2xl border border-gold-400/15 bg-black/20 p-4">
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${grad}`}>
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-stone-400">
        <span className="truncate">{label}</span>
        <Tip text={tip} />
      </p>
      <p className={`mt-1 truncate font-display text-3xl font-extrabold leading-tight ${accent}`}>{value}</p>
    </div>
  );
}

// اختصار سريع أنيق — بلاطة أيقونة ذهبية متدرّجة واضحة (تبرز بالوضعين) + عنوان
function QuickAction({ to, label, Icon }) {
  return (
    <Link to={to} className="group flex flex-col items-center gap-2.5 rounded-2xl border border-gold-400/15 bg-black/20 p-4 text-center transition duration-200 hover:-translate-y-0.5 hover:border-gold-400/40 hover:bg-gold-400/5">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md transition group-hover:brightness-110"
        style={{ background: 'linear-gradient(135deg, #e6c878 0%, #d4af37 55%, #b8932c 100%)' }}
      >
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="text-sm font-semibold text-stone-200">{label}</span>
    </Link>
  );
}

// أيقونة محفظة/إيراد (للمؤشّر الأول)
function WalletGlyph({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h13A1.5 1.5 0 0 1 19 7.5V9" /><rect x="3" y="9" width="18" height="10.5" rx="2.2" /><path d="M16.5 14.25h.01" />
    </svg>
  );
}
