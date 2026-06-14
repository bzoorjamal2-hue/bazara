import { useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../context/AuthContext.jsx';
import Seo from '../components/Seo.jsx';
import SubscriptionBanner from '../components/SubscriptionBanner.jsx';
import Profile from './dashboard/Profile.jsx';
import StoreSettings from './dashboard/StoreSettings.jsx';
import ProductsManager from './dashboard/ProductsManager.jsx';
import OrdersManager from './dashboard/OrdersManager.jsx';
import CouponsManager from './dashboard/CouponsManager.jsx';
import AnalyticsManager from './dashboard/AnalyticsManager.jsx';
import StockRequestsManager from './dashboard/StockRequestsManager.jsx';
import AdminRequests from './dashboard/AdminRequests.jsx';
import SubscribersManager from './dashboard/SubscribersManager.jsx';

// أقسام البائع (المشترك العادي)
const SECTIONS = [
  { key: 'overview', icon: '🏠' },
  { key: 'analytics', icon: '📊' },
  { key: 'profile', icon: '👤' },
  { key: 'storeSettings', icon: '⚙️' },
  { key: 'myProducts', icon: '🧺' },
  { key: 'myOrders', icon: '🧾' },
  { key: 'coupons', icon: '🎟️' },
  { key: 'stockRequests', icon: '🔔' },
];

// أقسام المدير (تحكّم فقط — بلا بيع/منتجات)
const ADMIN_SECTIONS = [
  { key: 'subscribers', icon: '👥' },
  { key: 'admin', icon: '🛡️' },
  { key: 'profile', icon: '👤' },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, store, subscription } = useAuth();
  const [params, setParams] = useSearchParams();
  const [productsCount, setProductsCount] = useState(null);
  const isAdmin = subscription?.isAdmin;
  const sections = isAdmin ? ADMIN_SECTIONS : SECTIONS;
  const allowed = sections.map((s) => s.key);
  const defaultTab = isAdmin ? 'subscribers' : 'overview';
  const raw = params.get('tab') || defaultTab;
  // المدير لا يصل لأقسام البيع حتى عبر الرابط
  const section = allowed.includes(raw) ? raw : defaultTab;
  const setSection = (key) => setParams(key === defaultTab ? {} : { tab: key });
  const labelFor = (key) =>
    key === 'admin' ? t('admin.nav') : key === 'subscribers' ? t('admin.subscribersNav') : t(`dashboard.${key}`);

  const avatar = user?.avatarUrl ? (
    <img src={user.avatarUrl} alt={user.name} className="h-12 w-12 rounded-full border border-gold-400/40 object-cover" />
  ) : (
    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/15 text-lg font-bold text-gold-200">
      {user?.name?.[0] || '👤'}
    </span>
  );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Seo title={t('dashboard.title')} />

      {/* التنقّل عبر القائمة المنسدلة (☰) بالأعلى */}
      <div className="min-w-0">
        {section === 'overview' && !isAdmin && <Overview productsCount={productsCount} />}
        {section === 'analytics' && !isAdmin && <AnalyticsManager />}
        {section === 'profile' && <Profile />}
        {section === 'storeSettings' && !isAdmin && <StoreSettings />}
        {section === 'myProducts' && !isAdmin && <ProductsManager onCount={setProductsCount} />}
        {section === 'myOrders' && !isAdmin && <OrdersManager />}
        {section === 'coupons' && !isAdmin && <CouponsManager />}
        {section === 'stockRequests' && !isAdmin && <StockRequestsManager />}
        {section === 'subscribers' && isAdmin && <SubscribersManager />}
        {section === 'admin' && isAdmin && <AdminRequests />}
      </div>
    </div>
  );
}

function Overview({ productsCount }) {
  const { t } = useTranslation();
  const { store, subscription } = useAuth();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);
  const publicUrl = store ? `${window.location.origin}/store/${store.slug}` : '';

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
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold gradient-text">{t('dashboard.overview')}</h1>

      <SubscriptionBanner />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass p-6">
          <p className="text-sm text-stone-400">{t('dashboard.productsCount')}</p>
          <p className="mt-2 font-display text-4xl font-extrabold text-gold-300">{productsCount ?? '—'}</p>
        </div>
        <div className="glass p-6">
          <p className="text-sm text-stone-400">{t('dashboard.store.name')}</p>
          <p className="mt-2 truncate font-display text-2xl font-bold text-stone-100">{store?.name}</p>
        </div>
      </div>

      {store && (
        <div className="glass p-6">
          <p className="mb-2 text-sm text-stone-400">{t('dashboard.store.publicLink')}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-xl bg-black/40 px-4 py-2.5 text-sm text-gold-200" dir="ltr">
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
        <div className="glass flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center">
          <div ref={qrRef} className="rounded-2xl bg-white p-3">
            <QRCodeCanvas value={publicUrl} size={148} level="M" includeMargin={false} />
          </div>
          <div className="text-center sm:text-start">
            <p className="font-display text-lg font-bold text-gold-200">{t('qr.title')}</p>
            <p className="mt-1 text-sm text-stone-400">{t('qr.hint')}</p>
            {subscription?.subscriberCode && (
              <p className="mt-2 text-sm text-stone-300">
                {t('subscription.subscriberCode')}:{' '}
                <span className="font-mono font-bold text-gold-300" dir="ltr">{subscription.subscriberCode}</span>
              </p>
            )}
            <button onClick={downloadQr} className="btn-ghost mt-3 text-sm">⬇️ {t('qr.download')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
