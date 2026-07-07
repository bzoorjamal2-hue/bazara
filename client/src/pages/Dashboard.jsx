import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../context/AuthContext.jsx';
import Seo from '../components/Seo.jsx';
import {
  UserIcon, DownloadIcon, HomeIcon, ChartIcon, GearIcon, BagIcon, ReceiptIcon,
  TicketIcon, GiftIcon, BellIcon, UsersIcon, ShieldIcon, ImageIcon, StoreIcon, LinkIcon,
} from '../components/icons.jsx';
import SubscriptionBanner from '../components/SubscriptionBanner.jsx';
import Profile from './dashboard/Profile.jsx';
import StoreSettings from './dashboard/StoreSettings.jsx';
import ProductsManager from './dashboard/ProductsManager.jsx';
import OrdersManager from './dashboard/OrdersManager.jsx';
import CouponsManager from './dashboard/CouponsManager.jsx';
import ReferralsManager from './dashboard/ReferralsManager.jsx';
import AnalyticsManager from './dashboard/AnalyticsManager.jsx';
import StockRequestsManager from './dashboard/StockRequestsManager.jsx';
import AdminRequests from './dashboard/AdminRequests.jsx';
import SubscribersManager from './dashboard/SubscribersManager.jsx';
import SiteSliders from './dashboard/SiteSliders.jsx';

// أقسام البائع (المشترك العادي) — الاستخدام اليومي أولاً (الطلبات/المنتجات)
const SECTIONS = [
  { key: 'overview', Icon: HomeIcon },
  { key: 'myOrders', Icon: ReceiptIcon },
  { key: 'myProducts', Icon: BagIcon },
  { key: 'analytics', Icon: ChartIcon },
  { key: 'coupons', Icon: TicketIcon },
  { key: 'referrals', Icon: GiftIcon },
  { key: 'stockRequests', Icon: BellIcon },
  { key: 'storeSettings', Icon: GearIcon },
  { key: 'profile', Icon: UserIcon },
];

// أقسام المدير (تحكّم فقط — بلا بيع/منتجات)
const ADMIN_SECTIONS = [
  { key: 'subscribers', Icon: UsersIcon },
  { key: 'admin', Icon: ShieldIcon },
  { key: 'siteSliders', Icon: ImageIcon },
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
  const defaultTab = isAdmin ? 'subscribers' : 'overview';
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
        {section === 'myOrders' && !isAdmin && <OrdersManager />}
        {section === 'coupons' && !isAdmin && <CouponsManager />}
        {section === 'referrals' && !isAdmin && <ReferralsManager />}
        {section === 'stockRequests' && !isAdmin && <StockRequestsManager />}
        {section === 'subscribers' && isAdmin && <SubscribersManager />}
        {section === 'admin' && isAdmin && <AdminRequests />}
        {section === 'siteSliders' && isAdmin && <SiteSliders />}
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
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());

  return (
    <div className="space-y-6">
      <SubscriptionBanner />

      {/* المؤشّرات الرئيسية — بطاقات موحّدة ببلاطة أيقونة متدرّجة (متناسقة مع الإحصائيات) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label={t('dashboard.analytics.revenue')} value={stats ? `${cur}${fmt(stats.revenue)}` : '—'} Icon={WalletGlyph} grad="from-emerald-400 to-teal-500" accent="text-emerald-300" />
        <MetricCard label={t('dashboard.analytics.newOrders')} value={fmt(stats?.newOrders)} Icon={ReceiptIcon} grad="from-gold-400 to-amber-500" accent="text-gold-300" />
        <MetricCard label={t('dashboard.visitors')} value={fmt(visitors)} Icon={UsersIcon} grad="from-sky-400 to-indigo-500" accent="text-sky-300" />
        <MetricCard label={t('dashboard.productsCount')} value={fmt(productCount)} Icon={BagIcon} grad="from-wine to-rose-700" accent="text-stone-100" />
      </div>

      {/* إجراءات سريعة — اختصارات لأكثر ما يستخدمه صاحب المتجر يومياً */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-stone-300">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction to="/dashboard?tab=myProducts" label={t('dashboard.myProducts')} Icon={BagIcon} />
          <QuickAction to="/dashboard?tab=myOrders" label={t('dashboard.myOrders')} Icon={ReceiptIcon} />
          <QuickAction to="/dashboard?tab=analytics" label={t('dashboard.analytics.title')} Icon={ChartIcon} />
          <QuickAction to="/dashboard?tab=storeSettings" label={t('dashboard.storeSettings')} Icon={GearIcon} />
        </div>
      </div>

      {/* شارك متجرك: الرابط + رمز QR في بطاقة واحدة متناسقة (بدل بطاقتين منفصلتين) */}
      {store && (
        <div className="glass relative overflow-hidden p-6">
          <span className="dash-hairline absolute inset-x-0 top-0" />
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400/10 text-gold-300 ring-1 ring-gold-400/20">
              <LinkIcon className="h-4 w-4" />
            </span>
            <p className="font-display text-base font-bold text-gold-200">{t('dashboard.store.shareStore')}</p>
          </div>
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
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
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

// بطاقة مؤشّر موحّدة — بلاطة أيقونة متدرّجة + رقم بارز (نفس لغة صفحة الإحصائيات)
function MetricCard({ label, value, Icon, grad, accent }) {
  return (
    <div className="glass relative overflow-hidden p-5">
      <span aria-hidden className={`pointer-events-none absolute -end-6 -top-8 h-20 w-20 rounded-full bg-gradient-to-br ${grad} opacity-15 blur-2xl`} />
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md ${grad}`}>
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <p className="mt-3 text-xs font-medium text-stone-400">{label}</p>
      <p className={`mt-1 truncate font-display text-3xl font-extrabold leading-tight ${accent}`}>{value}</p>
    </div>
  );
}

// اختصار سريع أنيق — بلاطة أيقونة ذهبية متدرّجة واضحة (تبرز بالوضعين) + عنوان
function QuickAction({ to, label, Icon }) {
  return (
    <Link to={to} className="glass group flex flex-col items-center gap-2.5 p-4 text-center transition duration-200 hover:-translate-y-0.5">
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
