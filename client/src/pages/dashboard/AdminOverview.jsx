import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { UsersIcon, BagIcon, ReceiptIcon, MailIcon, BellIcon, CrownIcon, ChartIcon } from '../../components/icons.jsx';

// بطاقة إحصائية واحدة — رقم كبير + عنوان + أيقونة، بأسلوب لوحة المتاجر الكبرى.
function Stat({ Icon, label, value, sub, tone = 'gold', to }) {
  const tones = {
    gold: 'from-gold-400/15 to-gold-400/5 text-gold-300 ring-gold-400/25',
    emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-300 ring-emerald-400/25',
    red: 'from-red-500/15 to-red-500/5 text-red-300 ring-red-400/25',
    wine: 'from-wine/20 to-wine/5 text-gold-200 ring-gold-400/20',
  };
  const inner = (
    <div className="glass flex items-center gap-3 p-4 transition hover:-translate-y-0.5">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-2xl font-extrabold leading-none text-stone-100">{value}</p>
        <p className="mt-1 truncate text-xs font-medium text-stone-400">{label}</p>
        {sub && <p className="mt-0.5 truncate text-[11px] text-stone-500">{sub}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

// نظرة عامة على المنصّة للمدير — أرقام حقيقية مجمّعة من قاعدة البيانات.
export default function AdminOverview() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/subscription/admin-stats').then((r) => setData(r.data)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  if (!data && !error) return <Spinner />;

  const cur = t('common.currency');
  const gmv = data ? `${cur}${Number(data.gmv).toLocaleString()}` : '—';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold gradient-text">{t('admin.ov.title')}</h1>
        <p className="mt-1 text-sm text-stone-400">{t('admin.ov.hint')}</p>
      </div>
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {data && (
        <>
          {/* طلبات الاشتراك المعلّقة — تنبيه بارز يفتح قسم الإدارة مباشرةً */}
          {data.pendingRequests > 0 && (
            <Link to="/dashboard?tab=admin" className="glass flex items-center gap-3 border-gold-400/30 p-4 ring-1 ring-gold-400/30 transition hover:-translate-y-0.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-400 text-ink-950"><BellIcon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gold-200">{t('admin.ov.pending', { count: data.pendingRequests })}</p>
                <p className="text-xs text-stone-400">{t('admin.ov.pendingHint')}</p>
              </div>
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat Icon={UsersIcon} tone="gold" label={t('admin.ov.stores')} value={data.totalStores}
              sub={data.newStoresThisMonth > 0 ? t('admin.ov.newThisMonth', { count: data.newStoresThisMonth }) : null}
              to="/dashboard?tab=subscribers" />
            <Stat Icon={CrownIcon} tone="emerald" label={t('admin.ov.activeSubs')} value={data.activeSubs} to="/dashboard?tab=subscribers" />
            <Stat Icon={CrownIcon} tone="red" label={t('admin.ov.expiredSubs')} value={data.expiredSubs} to="/dashboard?tab=subscribers" />
            <Stat Icon={BagIcon} tone="wine" label={t('admin.ov.products')} value={data.totalProducts} />
            <Stat Icon={ReceiptIcon} tone="wine" label={t('admin.ov.orders')} value={data.totalOrders}
              sub={data.newOrders > 0 ? t('admin.ov.newOrders', { count: data.newOrders }) : null} />
            <Stat Icon={ChartIcon} tone="emerald" label={t('admin.ov.gmv')} value={gmv} />
            <Stat Icon={MailIcon} tone="gold" label={t('admin.ov.newsletter')} value={data.newsletterSubscribers} to="/dashboard?tab=newsletter" />
          </div>
        </>
      )}
    </div>
  );
}
