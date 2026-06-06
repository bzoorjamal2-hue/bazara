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
import AdminRequests from './dashboard/AdminRequests.jsx';

const SECTIONS = [
  { key: 'overview', icon: '📊' },
  { key: 'profile', icon: '👤' },
  { key: 'storeSettings', icon: '⚙️' },
  { key: 'myProducts', icon: '🧺' },
  { key: 'myOrders', icon: '🧾' },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, store, subscription } = useAuth();
  const [params, setParams] = useSearchParams();
  const section = params.get('tab') || 'overview';
  const setSection = (key) => setParams(key === 'overview' ? {} : { tab: key });
  const [productsCount, setProductsCount] = useState(null);
  const isAdmin = subscription?.isAdmin;
  const sections = isAdmin ? [...SECTIONS, { key: 'admin', icon: '🛡️' }] : SECTIONS;

  const avatar = user?.avatarUrl ? (
    <img src={user.avatarUrl} alt={user.name} className="h-12 w-12 rounded-full border border-gold-400/40 object-cover" />
  ) : (
    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/15 text-lg font-bold text-gold-200">
      {user?.name?.[0] || '👤'}
    </span>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Seo title={t('dashboard.title')} />

      {/* الشريط الجانبي (مخفي على الموبايل — القائمة ☰ بالأعلى تغطّيه) */}
      <aside className="hidden h-fit p-4 lg:sticky lg:top-24 lg:block glass-strong">
        <div className="mb-4 flex items-center gap-3 border-b border-gold-400/15 pb-4">
          {avatar}
          <div className="min-w-0">
            <p className="text-xs text-stone-400">{t('dashboard.welcome')}</p>
            <p className="truncate font-semibold text-stone-100">{user?.name}</p>
          </div>
        </div>
        <nav className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                section === s.key ? 'bg-gold-400/15 text-gold-100' : 'text-stone-300 hover:bg-white/5'
              }`}
            >
              <span>{s.icon}</span>
              {s.key === 'admin' ? t('admin.nav') : t(`dashboard.${s.key}`)}
            </button>
          ))}
        </nav>
        {store && (
          <Link to={`/store/${store.slug}`} className="btn-ghost mt-4 w-full !justify-start text-sm" target="_blank" rel="noreferrer">
            🔗 {t('dashboard.viewPublicStore')}
          </Link>
        )}
      </aside>

      {/* المحتوى */}
      <div className="min-w-0">
        {section === 'overview' && <Overview productsCount={productsCount} />}
        {section === 'profile' && <Profile />}
        {section === 'storeSettings' && <StoreSettings />}
        {section === 'myProducts' && <ProductsManager onCount={setProductsCount} />}
        {section === 'myOrders' && <OrdersManager />}
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
