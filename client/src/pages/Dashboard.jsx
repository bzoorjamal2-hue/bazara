import { useState, useRef, useEffect } from 'react';
import NotificationsBell from '../components/NotificationsBell.jsx';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { useTranslation } from 'react-i18next';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../context/AuthContext.jsx';
import Seo from '../components/Seo.jsx';
import {
  UserIcon, DownloadIcon, HomeIcon, ChartIcon, GearIcon, BagIcon, ReceiptIcon,
  TicketIcon, GiftIcon, BellIcon, UsersIcon, ShieldIcon, ImageIcon, StoreIcon, LinkIcon, MailIcon, InstagramIcon, BoltIcon, CashIcon,
} from '../components/icons.jsx';
import SubscriptionBanner from '../components/SubscriptionBanner.jsx';
import { SectionHead, Tip, PageHead } from '../components/FormField.jsx';
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
import AdminLog from './dashboard/AdminLog.jsx';
import AdminSettings from './dashboard/AdminSettings.jsx';
import SubscribersManager from './dashboard/SubscribersManager.jsx';
import SiteSliders from './dashboard/SiteSliders.jsx';
import LandingEditor from './dashboard/LandingEditor.jsx';
import NewsletterManager from './dashboard/NewsletterManager.jsx';
import InstagramInbox from './dashboard/InstagramInbox.jsx';
import CampaignManager from './dashboard/CampaignManager.jsx';
import FinanceManager from './dashboard/FinanceManager.jsx';

// أقسام البائع (المشترك العادي) — الاستخدام اليومي أولاً (الطلبات/المنتجات)
const SECTIONS = [
  { key: 'overview', Icon: HomeIcon },
  { key: 'myOrders', Icon: ReceiptIcon },
  { key: 'myProducts', Icon: BagIcon },
  { key: 'instagram', Icon: InstagramIcon },
  { key: 'analytics', Icon: ChartIcon },
  { key: 'finance', Icon: CashIcon },
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
  { key: 'adminLog', Icon: ShieldIcon },
  { key: 'adminSettings', Icon: GearIcon },
  { key: 'landing', Icon: HomeIcon },
  { key: 'siteSliders', Icon: ImageIcon },
  { key: 'newsletter', Icon: MailIcon },
  { key: 'broadcast', Icon: MailIcon },
  { key: 'profile', Icon: UserIcon },
];

const TAB_KEY = 'bz_dash_tab'; // آخر قسم فُتح باللوحة (لهذه الجلسة)

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, store, subscription } = useAuth();
  const [params, setParams] = useSearchParams();
  const [productsCount, setProductsCount] = useState(null);
  const [newOrders, setNewOrders] = useState(0);
  const isAdmin = subscription?.isAdmin;

  // عدّاد الطلبات الجديدة في الرأس: أهمّ ما تفتح المالكة اللوحة لأجله، وكان
  // لا يظهر إلا بعد فتح تبويب الطلبات. طلبٌ خفيف مستقلّ عن إحصاءات النظرة.
  useEffect(() => {
    if (isAdmin) return;
    api.get('/orders/new-count').then((r) => setNewOrders(r.data.count || 0)).catch(() => {});
  }, [isAdmin]);
  // التنقّل بين الأقسام عبر قائمة ☰ (Navbar) — المصدر الوحيد بلا تكرار
  const allowed = (isAdmin ? ADMIN_SECTIONS : SECTIONS).map((s) => s.key);
  const defaultTab = isAdmin ? 'adminOverview' : 'overview';
  // فتح اللوحة بلا ?tab (من زرّ «حسابي» بالشريط السفلي مثلاً) يرجع لآخر قسمٍ كان
  // فيه صاحب المتجر لا لـ«نظرة عامة»: كان يخرج ليتأكّد من شي فيرجع من الصفر.
  const remembered = (() => { try { return sessionStorage.getItem(TAB_KEY) || ''; } catch { return ''; } })();
  const raw = params.get('tab') || remembered || defaultTab;
  // المدير لا يصل لأقسام البيع حتى عبر الرابط
  const section = allowed.includes(raw) ? raw : defaultTab;

  // نُثبّت القسم بالرابط كي يتطابق إبراز القائمة الجانبية واستعادة موضع التمرير
  useEffect(() => {
    if (!params.get('tab') && section !== defaultTab) {
      const next = new URLSearchParams(params); // نُبقي أي معاملات أخرى بالرابط
      next.set('tab', section);
      setParams(next, { replace: true });
    }
    try { sessionStorage.setItem(TAB_KEY, section); } catch { /* تصفّح خاص */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const avatar = user?.avatarUrl ? (
    <img src={user.avatarUrl} alt={user.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-[#cdbda4]/60" />
  ) : (
    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F4EDE2]/10 text-xl font-bold text-[#cdbda4] ring-2 ring-[#cdbda4]/60">
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
          {/* جرس الإشعارات: رقمه هو نفسه رقم شارة أيقونة التطبيق */}
          {!isAdmin && <NotificationsBell />}
          {/* على الموبايل الزر يأخذ سطراً كاملاً لوحده — يترك عرض الشاشة لاسم المتجر */}
          {!isAdmin && store && (
            <Link
              to={`/store/${store.slug}`}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#cdbda4]/40 bg-[#F4EDE2]/10 px-4 py-2 text-sm font-semibold text-[#F4EDE2] transition hover:bg-[#F4EDE2]/20 sm:w-auto"
            >
              <StoreIcon className="h-4 w-4" /> {t('dashboard.viewStore')}
            </Link>
          )}
        </div>

        {/* حالة المتجر وإجراءاته اليومية داخل الرأس. كان الرأس تحيّةً واسماً
            فقط: جميلٌ ولا يقول شيئاً ولا يقود إلى فعل. */}
        {!isAdmin && store && (
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            {/* حالة الاشتراك: أخطر ما قد يفاجئ المالكة هو إقفال متجرها */}
            {subscription && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                style={subscription.active
                  ? (subscription.daysRemaining != null && subscription.daysRemaining <= 7
                    ? { background: '#92400e', color: '#F4EDE2' }
                    : { background: 'rgba(4,120,87,0.9)', color: '#F4EDE2' })
                  : { background: '#b91c1c', color: '#F4EDE2' }}
              >
                <BoltIcon className="h-3.5 w-3.5" />
                {subscription.active
                  ? (subscription.daysRemaining != null
                    ? t('subscription.daysLeft', { count: subscription.daysRemaining })
                    : t('subscription.active'))
                  : t('subscription.expired')}
              </span>
            )}

            {/* الطلبات الجديدة: الرقم يقود إلى مكانه بضغطة */}
            {newOrders > 0 && (
              <Link
                to="/dashboard?tab=myOrders"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition hover:brightness-110"
                style={{ background: '#F4EDE2', color: '#3f2e22' }}
              >
                <ReceiptIcon className="h-3.5 w-3.5" /> {t('dashboard.heroNewOrders', { count: newOrders })}
              </Link>
            )}

            <Link
              to="/dashboard?tab=myProducts"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#cdbda4]/40 px-3 py-1.5 text-xs font-bold text-[#F4EDE2] transition hover:bg-[#F4EDE2]/15"
            >
              <BagIcon className="h-3.5 w-3.5" /> {t('dashboard.addProduct')}
            </Link>
            <Link
              to="/dashboard?tab=finance"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#cdbda4]/40 px-3 py-1.5 text-xs font-bold text-[#F4EDE2] transition hover:bg-[#F4EDE2]/15"
            >
              <CashIcon className="h-3.5 w-3.5" /> {t('finance.title')}
            </Link>
          </div>
        )}
      </header>

      <div className="min-w-0">
        {section === 'overview' && !isAdmin && <Overview productsCount={productsCount} />}
        {section === 'analytics' && !isAdmin && <AnalyticsManager />}
        {section === 'finance' && !isAdmin && <FinanceManager />}
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
        {section === 'adminLog' && isAdmin && <AdminLog />}
        {section === 'adminSettings' && isAdmin && <AdminSettings />}
        {section === 'landing' && isAdmin && <LandingEditor />}
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
      <PageHead icon={<HomeIcon className="h-6 w-6" />} title={t('dashboard.overview')} hint={t('dashboard.ovHint')} />

      <SubscriptionBanner />

      {/* المؤشّرات الرئيسية */}
      <div className={CARD}>
        <SectionHead icon={<ChartIcon className="h-5 w-5" />} title={t('dashboard.ovMetrics')} desc={t('dashboard.ovMetricsHint')} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label={t('dashboard.analytics.revenue')} tip={t('dashboard.ovRevenueTip')}
            value={stats ? <CountUp value={stats.revenue} format={(x) => `${cur}${Math.round(x).toLocaleString()}`} /> : '—'}
            Icon={WalletGlyph}
            badge={stats && stats.lastMonth > 0 ? <GrowthBadge pct={stats.monthGrowth} /> : null}
          />
          <MetricCard label={t('dashboard.analytics.newOrders')} tip={t('dashboard.ovNewOrdersTip')} value={stats ? <CountUp value={stats.newOrders} /> : '—'} Icon={ReceiptIcon} />
          <MetricCard label={t('dashboard.visitors')} tip={t('dashboard.ovVisitorsTip')} value={visitors != null ? <CountUp value={visitors} /> : '—'} Icon={UsersIcon} />
          <MetricCard label={t('dashboard.productsCount')} tip={t('dashboard.ovProductsTip')} value={productCount != null ? <CountUp value={productCount} /> : '—'} Icon={BagIcon} />
        </div>

        {/* اتجاه آخر ٧ أيام — يقرأ الشكل العام بلمحة قبل فتح صفحة الإحصائيات */}
        {stats?.daily?.length > 0 && (
          <div className="rounded-2xl border border-gold-400/15 bg-black/20 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-300">
                {t('dashboard.ovTrend')} <Tip text={t('dashboard.ovTrendTip')} />
              </p>
              <p className="text-[11px] tabular-nums text-stone-400">
                {cur}{Math.round(stats.daily.reduce((s, d) => s + d.revenue, 0)).toLocaleString()}
              </p>
            </div>
            <Sparkline points={stats.daily} cur={cur} />
          </div>
        )}
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

      {/* السلات المتروكة: زبونة ملأت سلّتها ولم تُكمل — أقرب مبيعات ممكنة، فتُعرض
          كفرصة قابلة للتصرّف لا كرقم صامت داخل الإحصائيات */}
      {stats?.abandonedCount > 0 && (
        <Link
          to="/dashboard?tab=analytics"
          className="bz-tone-amber group flex items-center gap-3 rounded-2xl p-4 transition hover:-translate-y-0.5"
        >
          <span className="bz-ico-amber flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
            <CartGlyph className="h-[22px] w-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {t('dashboard.ovAbandoned', { count: stats.abandonedCount, value: `${cur}${Math.round(stats.abandonedValue).toLocaleString()}` })}
            </p>
            <p className="mt-0.5 truncate text-xs text-stone-400">{t('dashboard.ovAbandonedCta')}</p>
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
function MetricCard({ label, value, Icon, tip, badge }) {
  return (
    <div className="rounded-2xl border border-gold-400/15 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="dash-ico inline-flex h-11 w-11 items-center justify-center rounded-2xl">
          <Icon className="h-[22px] w-[22px]" />
        </span>
        {badge}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-stone-400">
        <span className="truncate">{label}</span>
        <Tip text={tip} />
      </p>
      <p className="dash-stat mt-1 truncate text-3xl font-extrabold leading-tight">{value}</p>
    </div>
  );
}

// اختصار سريع أنيق — بلاطة أيقونة ذهبية متدرّجة واضحة (تبرز بالوضعين) + عنوان
function QuickAction({ to, label, Icon }) {
  return (
    <Link to={to} className="group flex flex-col items-center gap-2.5 rounded-2xl border border-gold-400/15 bg-black/20 p-4 text-center transition duration-200 hover:-translate-y-0.5 hover:border-gold-400/40 hover:bg-gold-400/5">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md transition group-hover:brightness-110"
        style={{ background: 'linear-gradient(135deg, #cdbda4 0%, #b09a7e 55%, #8a7657 100%)' }}
      >
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="text-sm font-semibold text-stone-200">{label}</span>
    </Link>
  );
}

// شارة نموّ الإيراد شهرياً: مقارنة هذا الشهر بالشهر الماضي. تُعرض فقط عند وجود
// شهر ماضٍ للمقارنة — «+100%» على متجر جديد رقم بلا معنى.
function GrowthBadge({ pct }) {
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
        up ? 'bz-tone-ok' : 'bz-tone-red'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

// خط اتجاه مصغّر لإيراد آخر ٧ أيام — SVG خالص (بلا مكتبة رسم) يرسم مساحة مملوءة
// تحت الخط. القيم مُطبَّعة على أعلى يوم، فيبقى الشكل مقروءاً مهما اختلف حجم الأرقام.
function Sparkline({ points, cur }) {
  const vals = points.map((p) => p.revenue);
  const max = Math.max(...vals, 1);
  const W = 100;
  const H = 32;
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const xy = points.map((p, i) => [i * step, H - (p.revenue / max) * (H - 4) - 2]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  // "YYYY-MM-DD" وحدها تُفسَّر UTC فينزاح اسم اليوم بالمناطق ذات الإزاحة السالبة —
  // نُلحق الوقت ليُقرأ التاريخ محلياً كما أرسله الخادم
  const dayLabel = (d) => new Date(`${d}T00:00`).toLocaleDateString(undefined, { weekday: 'short' });
  return (
    <div>
      {/* preserveAspectRatio=none يمدّ الرسم لعرض البطاقة كاملاً بأي شاشة */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-12 w-full" aria-hidden="true">
        <defs>
          <linearGradient id="bz-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b09a7e" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#b09a7e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#bz-spark)" />
        <path d={line} fill="none" stroke="#b09a7e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-stone-500">
        {points.map((p) => (
          <span key={p.day} title={`${cur}${Math.round(p.revenue).toLocaleString()}`}>{dayLabel(p.day)}</span>
        ))}
      </div>
    </div>
  );
}

// أيقونة سلّة متروكة (لبطاقة الفرصة الضائعة)
function CartGlyph({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.55L20.5 8H6" />
      <circle cx="10" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" />
    </svg>
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
