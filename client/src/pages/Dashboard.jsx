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
  const [params, setParams] = useSearchParams();
  const [productsCount, setProductsCount] = useState(null);
  const tabsRef = useRef(null);
  const isAdmin = subscription?.isAdmin;
  const sections = isAdmin ? ADMIN_SECTIONS : SECTIONS;
  const allowed = sections.map((s) => s.key);
  const defaultTab = isAdmin ? 'subscribers' : 'overview';
  const raw = params.get('tab') || defaultTab;
  // المدير لا يصل لأقسام البيع حتى عبر الرابط
  const section = allowed.includes(raw) ? raw : defaultTab;
  const setSection = (key) => setParams(key === defaultTab ? {} : { tab: key });
  const labelFor = (key) =>
    key === 'admin' ? t('admin.nav') : key === 'subscribers' ? t('admin.subscribersNav') : key === 'siteSliders' ? t('admin.siteSliders') : t(`dashboard.${key}`);

  // إبقاء التبويب النشط ظاهراً وسط الشريط (بلا قفزة عمودية للصفحة)
  useEffect(() => {
    tabsRef.current?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [section]);

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
            <h1 className="mt-0.5 truncate font-display text-2xl font-extrabold text-[#F4EDE2] sm:text-3xl">
              {isAdmin ? t('admin.nav') : (store?.name || t('dashboard.title'))}
            </h1>
          </div>
          {!isAdmin && store && (
            <Link
              to={`/store/${store.slug}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e6c878]/40 bg-[#F4EDE2]/10 px-4 py-2 text-sm font-semibold text-[#F4EDE2] transition hover:bg-[#F4EDE2]/20"
            >
              <StoreIcon className="h-4 w-4" /> {t('dashboard.viewStore')}
            </Link>
          )}
        </div>
      </header>

      {/* شريط تبويبات أنيق — تنقّل ظاهر بدل الاعتماد على القائمة فقط */}
      <nav ref={tabsRef} className="dash-tabs -mx-1 flex gap-2 overflow-x-auto px-1 py-1" aria-label={t('dashboard.title')}>
        {sections.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            data-active={section === key ? 'true' : 'false'}
            onClick={() => setSection(key)}
            className={section === key ? 'dash-tab dash-tab-active' : 'dash-tab'}
          >
            <Icon className="h-4 w-4" /> {labelFor(key)}
          </button>
        ))}
      </nav>

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

// بطاقة إحصائية فاخرة: خيط ذهبي علوي + رقم كبير بخط العرض + أيقونة بختم دائري
function StatCard({ label, value, Icon, hint, big = true }) {
  return (
    <div className="glass relative overflow-hidden p-6">
      <span className="dash-hairline absolute inset-x-0 top-0" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-stone-400">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400/10 text-gold-300">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={`mt-3 truncate font-display font-extrabold text-gold-300 ${big ? 'text-4xl' : 'text-2xl'}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
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

  return (
    <div className="space-y-5">
      <SubscriptionBanner />

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <StatCard label={t('dashboard.productsCount')} value={productCount ?? '—'} Icon={BagIcon} />
        <StatCard label={t('dashboard.visitors')} value={visitors ?? '—'} Icon={UsersIcon} hint={t('dashboard.visitorsHint')} />
        <div className="col-span-2 sm:col-span-1">
          <StatCard label={t('dashboard.store.name')} value={store?.name || '—'} Icon={StoreIcon} big={false} />
        </div>
      </div>

      {store && (
        <div className="glass relative overflow-hidden p-6">
          <span className="dash-hairline absolute inset-x-0 top-0" />
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400/10 text-gold-300">
              <LinkIcon className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-stone-300">{t('dashboard.store.publicLink')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-black/30 px-4 py-2.5 text-sm text-gold-200" dir="ltr">
              {publicUrl}
            </code>
            <button onClick={copy} className="btn-primary !py-2.5 text-sm">
              {copied ? t('common.copied') : t('common.copyLink')}
            </button>
          </div>
        </div>
      )}

      {/* رمز QR للمتجر */}
      {store && (
        <div className="glass relative flex flex-col items-center gap-5 overflow-hidden p-6 sm:flex-row">
          <span className="dash-hairline absolute inset-x-0 top-0" />
          <div ref={qrRef} className="rounded-2xl bg-white p-3 shadow-lg ring-1 ring-gold-400/30">
            <QRCodeCanvas value={publicUrl} size={148} level="M" includeMargin={false} />
          </div>
          <div className="min-w-0 text-center sm:text-start">
            <p className="font-display text-lg font-bold text-gold-200">{t('qr.title')}</p>
            <p className="mt-1 text-sm text-stone-400">{t('qr.hint')}</p>
            {subscription?.subscriberCode && (
              <p className="mt-2 text-sm text-stone-300">
                {t('subscription.subscriberCode')}:{' '}
                <span className="font-mono font-bold text-gold-300" dir="ltr">{subscription.subscriberCode}</span>
              </p>
            )}
            <button onClick={downloadQr} className="btn-ghost mt-3 gap-1.5 text-sm">
              <DownloadIcon className="h-4 w-4" /> {t('qr.download')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
