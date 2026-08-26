import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { UsersIcon, BagIcon, ReceiptIcon, MailIcon, BellIcon, CrownIcon, ChartIcon, ClockIcon, WarnIcon, LockIcon } from '../../components/icons.jsx';
import CountUp from '../../components/CountUp.jsx';
import { PageHead, SectionHead, Tip } from '../../components/FormField.jsx';

// بطاقة إحصائية واحدة — رقم كبير + عنوان + أيقونة، بأسلوب لوحة المتاجر الكبرى.
function Stat({ Icon, label, value, sub, tip, tone = 'gold', to }) {
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
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-stone-400"><span className="truncate">{label}</span> <Tip text={tip} /></p>
        {sub && <p className="mt-0.5 truncate text-[11px] text-stone-400">{sub}</p>}
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

  return (
    <div className="space-y-5">
      <PageHead icon={<ChartIcon className="h-6 w-6" />} title={t('admin.ov.title')} hint={t('admin.ov.hint')} />
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

          {/* توشك على الانتهاء: المنتهي خسارةٌ وقعت، والموشك فرصةٌ باقية */}
          {data.expiringSoon > 0 && (
            <Link
              to="/dashboard?tab=subscribers"
              className="flex items-center gap-3 rounded-2xl p-4 text-cream transition hover:-translate-y-0.5"
              style={{ background: '#92400e' }}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/20"><ClockIcon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{t('admin.ov.expiringSoon', { count: data.expiringSoon })}</p>
                <p className="text-xs opacity-90">{t('admin.ov.expiringSoonHint')}</p>
              </div>
            </Link>
          )}

          {/* متاجر اشتركت ولم تُطلق — تعثّرٌ لا يظهر في «إجمالي المتاجر» */}
          {data.emptyStores > 0 && (
            <Link
              to="/dashboard?tab=subscribers"
              className="flex items-center gap-3 rounded-2xl p-4 text-cream transition hover:-translate-y-0.5"
              style={{ background: '#57534e' }}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/20"><WarnIcon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{t('admin.ov.emptyStores', { count: data.emptyStores })}</p>
                <p className="text-xs opacity-90">{t('admin.ov.emptyStoresHint')}</p>
              </div>
            </Link>
          )}

          <SectionHead icon={<ChartIcon className="h-5 w-5" />} title={t('admin.ov.numbers')} desc={t('admin.ov.numbersDesc')} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat Icon={UsersIcon} tone="gold" label={t('admin.ov.stores')} value={<CountUp value={data.totalStores} />}
              tip={t('admin.ov.storesTip')}
              sub={data.newStoresThisMonth > 0 ? t('admin.ov.newThisMonth', { count: data.newStoresThisMonth }) : null}
              to="/dashboard?tab=subscribers&filter=all" />
            <Stat Icon={CrownIcon} tone="emerald" label={t('admin.ov.activeSubs')} value={<CountUp value={data.activeSubs} />} tip={t('admin.ov.activeTip')} to="/dashboard?tab=subscribers&filter=active" />
            <Stat Icon={CrownIcon} tone="red" label={t('admin.ov.expiredSubs')} value={<CountUp value={data.expiredSubs} />} tip={t('admin.ov.expiredTip')} to="/dashboard?tab=subscribers&filter=expired" />
            {/* الموقوف إدارياً بطاقةٌ مستقلّة: كان يُطرح مع المنتهين فيُقرأ
                كخسارةِ تجديد، وهو قرارُك أنتِ ولا يرفعه تجديد. */}
            {data.suspendedStores > 0 && (
              <Stat Icon={LockIcon} tone="red" label={t('admin.ov.suspended')} value={<CountUp value={data.suspendedStores} />} tip={t('admin.ov.suspendedTip')} to="/dashboard?tab=subscribers&filter=suspended" />
            )}
            <Stat Icon={BagIcon} tone="wine" label={t('admin.ov.products')} value={<CountUp value={data.totalProducts} />} tip={t('admin.ov.productsTip')} />
            <Stat Icon={ReceiptIcon} tone="wine" label={t('admin.ov.orders')} value={<CountUp value={data.totalOrders} />}
              tip={t('admin.ov.ordersTip')}
              sub={data.ordersThisMonth > 0 ? t('admin.ov.ordersThisMonth', { count: data.ordersThisMonth }) : null} />
            <Stat Icon={ChartIcon} tone="emerald" label={t('admin.ov.gmv')} value={<CountUp value={data.gmv} format={(x) => `${cur}${Math.round(x).toLocaleString()}`} />}
              tip={t('admin.ov.gmvTip')}
              sub={data.gmvThisMonth > 0 ? t('admin.ov.gmvThisMonth', { amount: `${cur}${Math.round(data.gmvThisMonth).toLocaleString()}` }) : null} />
            <Stat Icon={MailIcon} tone="gold" label={t('admin.ov.newsletter')} value={<CountUp value={data.newsletterSubscribers} />} tip={t('admin.ov.newsletterTip')} to="/dashboard?tab=newsletter" />
          </div>

          {/* الاتجاه: الرقم التراكميّ يكبر دائماً ولا يقول شيئاً عن الاتجاه */}
          {data.gmvChange != null && (
            <p className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-gold-400/15 bg-black/20 px-4 py-2.5 text-xs">
              <span className="text-stone-400">{t('admin.ov.monthTrend')}</span>
              <span
                className="rounded-full px-2 py-0.5 font-bold text-cream"
                style={{ background: data.gmvChange >= 0 ? '#047857' : '#b91c1c' }}
              >
                {data.gmvChange >= 0 ? '▲' : '▼'} {Math.abs(data.gmvChange)}%
              </span>
              <span className="tabular-nums font-semibold text-stone-200">
                {cur}{Math.round(data.gmvThisMonth).toLocaleString()}
              </span>
              <span className="text-stone-400">
                {t('admin.ov.vsLast', { amount: `${cur}${Math.round(data.gmvLastMonth).toLocaleString()}` })}
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
