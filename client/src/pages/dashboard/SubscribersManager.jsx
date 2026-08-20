import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { CrownIcon, LinkIcon, BellIcon, SaveIcon, PlusIcon, MailIcon, TrashIcon, StarIcon, UsersIcon, ChartIcon, BagIcon, ReceiptIcon } from '../../components/icons.jsx';
import { PageHead } from '../../components/FormField.jsx';
import AdminStoreDetail from './AdminStoreDetail.jsx';

function fmt(d) {
  return d ? new Date(d).toLocaleString() : '—';
}

// شارة رقم صغيرة داخل صفّ المشترك. البرتقالي المصمت للتنبيه (متجر بلا
// منتجات) — لونٌ شفّاف فوق خلفية فاتحة يهبط تحت عتبة القراءة.
function Chip({ Icon, value, label, warn = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${warn ? 'text-cream' : 'border border-gold-400/20 text-stone-300'}`}
      style={warn ? { background: '#9a3412' } : undefined}
      title={label}
    >
      <Icon className="h-3 w-3 shrink-0" /> {value}
    </span>
  );
}

function SubRow({ s, onDeleted, onUpdated, onOpen }) {
  const { t } = useTranslation();
  // نبدأ بالخطة التي طلبها المستخدم (إن وُجدت) ليفعّلها المدير مباشرة، وإلا الخطة الحالية
  const [plan, setPlan] = useState(s.requestedPlan || s.plan || 'monthly');
  const [days, setDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [daysBusy, setDaysBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [featBusy, setFeatBusy] = useState(false);

  // تمييز/إلغاء تمييز المتجر — يتصدّر «متاجر مميزة» بالرئيسية
  const toggleFeatured = async () => {
    setErr(''); setFeatBusy(true);
    const next = !s.featured;
    try {
      await api.post('/subscription/set-featured', { email: s.email, featured: next });
      onUpdated?.(s.email, { featured: next });
    } catch (e) {
      setErr(getErrorMessage(e, t('errors.generic')));
    } finally {
      setFeatBusy(false);
    }
  };

  const send = async () => {
    setMsg(''); setErr(''); setBusy(true);
    try {
      await api.post('/subscription/send-code', { email: s.email, plan });
      setMsg(`${t('admin.codeSentTo')} ${s.email}`);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setErr(getErrorMessage(e, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  // حفظ التعديلات: يضبط الخطة ويعيد ضبط تاريخ البدء = الآن والانتهاء = الآن + المدة
  const save = async () => {
    setMsg(''); setErr(''); setSaveBusy(true);
    try {
      const r = await api.post('/subscription/set-subscription', { email: s.email, plan });
      onUpdated?.(s.email, {
        plan,
        status: 'active',
        active: true,
        startedAt: r.data.startedAt,
        currentPeriodEnd: r.data.currentPeriodEnd,
      });
      setMsg(t('admin.subSaved'));
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setErr(getErrorMessage(e, t('errors.generic')));
    } finally {
      setSaveBusy(false);
    }
  };

  // إضافة أيام إضافية (1–365) على تاريخ الانتهاء الحالي
  const addDays = async () => {
    setMsg(''); setErr('');
    const n = parseInt(days, 10);
    if (!n || n < 1 || n > 365) { setErr(t('admin.daysRange')); return; }
    setDaysBusy(true);
    try {
      const r = await api.post('/subscription/add-days', { email: s.email, days: n });
      onUpdated?.(s.email, { status: 'active', active: true, currentPeriodEnd: r.data.currentPeriodEnd });
      setDays('');
      setMsg(t('admin.daysAdded', { count: n }));
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setErr(getErrorMessage(e, t('errors.generic')));
    } finally {
      setDaysBusy(false);
    }
  };

  const dirty = plan !== (s.plan || 'monthly');

  const remove = async () => {
    setErr(''); setDelBusy(true);
    try {
      await api.post('/subscription/delete-subscriber', { email: s.email });
      onDeleted?.(s.email);
    } catch (e) {
      setErr(getErrorMessage(e, t('errors.generic')));
      setDelBusy(false);
      setConfirmDel(false);
    }
  };

  const statusBadge = s.isAdmin ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1 text-xs font-bold text-ink-950 shadow-sm">
      <CrownIcon className="h-3.5 w-3.5" /> {t('admin.statusAdmin')}
    </span>
  ) : s.active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
      <span className="h-2 w-2 rounded-full bg-white" /> {t('admin.statusActive')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
      <span className="h-2 w-2 rounded-full bg-white" /> {t('admin.statusLocked')}
    </span>
  );

  return (
    <div className="glass p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-100">{s.name}</span>
            {statusBadge}
          </div>
          <p className="mt-1 text-xs text-stone-400" dir="ltr">{s.email}</p>
        </div>
        {/* المدير حساب تحكّم — بلا رابط متجر عام */}
        {!s.isAdmin && (
          <div className="flex items-center gap-3">
            {/* تمييز المتجر ليتصدّر «متاجر مميزة» بالرئيسية */}
            <button
              onClick={toggleFeatured}
              disabled={featBusy}
              title={s.featured ? t('admin.unfeature') : t('admin.feature')}
              aria-pressed={s.featured}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition disabled:opacity-50 ${s.featured ? 'bg-gold-400 text-ink-950 shadow-sm' : 'border border-gold-400/30 text-stone-300 hover:bg-gold-400/10'}`}
            >
              <StarIcon className="h-3.5 w-3.5" filled={s.featured} /> {s.featured ? t('admin.featured') : t('admin.feature')}
            </button>
            <button
              type="button"
              onClick={() => onOpen?.(s.storeSlug)}
              className="inline-flex items-center gap-1 rounded-full border border-gold-400/30 px-2.5 py-1 text-xs font-bold text-gold-200 transition hover:bg-gold-400/10"
            >
              <ChartIcon className="h-3.5 w-3.5" /> {t('admin.storeDetail')}
            </button>
            <a href={`/store/${s.storeSlug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gold-300 hover:text-gold-200"><LinkIcon className="h-3.5 w-3.5" /> {t('admin.subStore')}</a>
          </div>
        )}
      </div>

      {/* حجم المتجر بلمحة — بلا هذه الأرقام كان الصفّ اسماً وبريداً فقط */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Chip Icon={BagIcon} value={s.productsCount ?? 0} label={t('admin.ov.products')} warn={(s.productsCount ?? 0) === 0} />
        <Chip Icon={ReceiptIcon} value={s.ordersCount ?? 0} label={t('admin.ov.orders')} />
        <Chip Icon={ChartIcon} value={`${t('common.currency')}${Math.round(s.gmv || 0).toLocaleString()}`} label={t('admin.ov.gmv')} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs text-stone-400 sm:grid-cols-3 sm:gap-2">
        <div>
          <span className="text-stone-500">{t('admin.subPlan')}:</span>{' '}
          {s.lifetime ? t('admin.lifetime') : s.plan ? t(`subscription.${s.plan}`) : t('admin.subNone')}
          {/* الخطة التي اختارها المستخدم عند التسجيل — ليفعّلها المدير مباشرة */}
          {!s.isAdmin && s.requestedPlan && (
            <span className="ms-2 inline-flex items-center rounded-full bg-gold-400/15 px-2 py-0.5 text-[11px] font-bold text-gold-300 ring-1 ring-gold-400/30">
              <BellIcon className="inline h-4 w-4" /> {t('admin.requested')}: {t(`subscription.${s.requestedPlan}`)}
            </span>
          )}
        </div>
        <div><span className="text-stone-500">{t('admin.subStarted')}:</span> {fmt(s.startedAt)}</div>
        <div>
          <span className="text-stone-500">{t('admin.subExpires')}:</span>{' '}
          {s.lifetime ? <span className="font-semibold text-gold-300">{t('admin.noExpiry')}</span> : fmt(s.currentPeriodEnd)}
        </div>
      </div>

      {msg && <div className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">{msg}</div>}
      {err && <div className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">{err}</div>}

      {!s.isAdmin && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {/* المجموعة 1: الخطة + حفظ التعديلات */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={plan}
              onChange={setPlan}
              className="!w-auto !py-1.5 text-sm"
              options={[
                { value: 'monthly', label: `${t('subscription.monthly')} ($25)` },
                { value: 'yearly', label: `${t('subscription.yearly')} ($250)` },
              ]}
            />
            <button onClick={save} disabled={saveBusy} className={`!py-1.5 text-sm flex-1 sm:flex-none ${dirty ? 'btn-primary' : 'btn-ghost'}`}>
              {saveBusy ? t('common.loading') : <span className="inline-flex items-center gap-1.5"><SaveIcon className="h-4 w-4" /> {t('admin.saveChanges')}</span>}
            </button>
          </div>

          {/* المجموعة 2: إضافة أيام إضافية (1–365) */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={3}
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder={t('admin.daysPlaceholder')}
              className="input !w-20 shrink-0 !py-1.5 text-center text-sm"
            />
            <button onClick={addDays} disabled={daysBusy} className="btn-primary !py-1.5 text-sm flex-1 sm:flex-none">
              {daysBusy ? t('common.loading') : <span className="inline-flex items-center gap-1.5"><PlusIcon className="h-4 w-4" /> {t('admin.addDaysBtn')}</span>}
            </button>
          </div>

          {/* المجموعة 3: إرسال الكود + حذف الحساب */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={send} disabled={busy} className="btn-ghost !py-1.5 text-sm flex-1 sm:flex-none">
              {busy ? t('common.loading') : <span className="inline-flex items-center gap-1.5"><MailIcon className="h-4 w-4" /> {t('admin.sendCodeBtn')}</span>}
            </button>
            {confirmDel ? (
              <span className="flex flex-1 items-center gap-2 sm:flex-none">
                <button onClick={remove} disabled={delBusy} className="flex-1 rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500 sm:flex-none">
                  {delBusy ? t('common.loading') : <span className="inline-flex items-center gap-1.5"><TrashIcon className="h-4 w-4" /> {t('admin.confirmDelete')}</span>}
                </button>
                <button onClick={() => setConfirmDel(false)} className="text-sm text-stone-400 hover:text-stone-200">{t('common.cancel')}</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-400/40 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/10 flex-1 sm:flex-none">
                <TrashIcon className="h-4 w-4" /> {t('admin.deleteAccount')}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default function SubscribersManager() {
  const { t } = useTranslation();
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | expired | requested
  const [sort, setSort] = useState('newest');  // newest | gmv | orders | expiry
  const [openSlug, setOpenSlug] = useState('');

  useEffect(() => {
    api.get('/subscription/subscribers').then((r) => setSubs(r.data.subscribers)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  if (subs === null && !error) return <Spinner />;

  // فلترة محلية على القائمة المحمّلة — بحث بالاسم/الإيميل/اسم المتجر + حالة الاشتراك
  const query = q.trim().toLowerCase();
  const shown = [...(subs || [])].filter((s) => {
    if (query && !`${s.name} ${s.email} ${s.storeName || ''}`.toLowerCase().includes(query)) return false;
    if (filter === 'active') return s.active;
    if (filter === 'expired') return !s.active && !s.isAdmin;
    if (filter === 'requested') return s.requestedStatus === 'pending';
    return true;
  });

  // الفرز: المدير يبحث عن «الأكبر مبيعاً» أو «الأقرب انتهاءً» لا عن الأحدث دائماً
  const sorters = {
    newest: () => 0,
    gmv: (a, b) => (b.gmv || 0) - (a.gmv || 0),
    orders: (a, b) => (b.ordersCount || 0) - (a.ordersCount || 0),
    expiry: (a, b) => {
      // بلا تاريخ انتهاء (مدير/مدى الحياة) يُدفع لآخر القائمة لا لأوّلها
      const av = a.currentPeriodEnd ? new Date(a.currentPeriodEnd).getTime() : Infinity;
      const bv = b.currentPeriodEnd ? new Date(b.currentPeriodEnd).getTime() : Infinity;
      return av - bv;
    },
  };
  shown.sort(sorters[sort] || sorters.newest);

  const counts = {
    all: subs?.length || 0,
    active: (subs || []).filter((s) => s.active).length,
    expired: (subs || []).filter((s) => !s.active && !s.isAdmin).length,
    requested: (subs || []).filter((s) => s.requestedStatus === 'pending').length,
  };
  const chips = [
    { key: 'all', label: t('admin.filterAll') },
    { key: 'active', label: t('admin.statusActive') },
    { key: 'expired', label: t('admin.statusLocked') },
    { key: 'requested', label: t('admin.requested') },
  ];

  return (
    <div className="space-y-5">
      <PageHead icon={<UsersIcon className="h-6 w-6" />} title={t('admin.subscribersTitle')} hint={t('admin.subscribersHint')} />
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {/* بحث + فلترة بالحالة — يصير ضرورياً مع كثرة المتاجر */}
      {subs && subs.length > 0 && (
        <div className="space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.searchSubscribers')}
            className="input w-full"
          />
          <div className="w-44">
            <Select
              value={sort}
              onChange={setSort}
              className="!py-2 text-sm"
              options={[
                { value: 'newest', label: t('admin.sortNewest') },
                { value: 'gmv', label: t('admin.sortGmv') },
                { value: 'orders', label: t('admin.sortOrders') },
                { value: 'expiry', label: t('admin.sortExpiry') },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${filter === c.key ? 'bg-gold-400 text-ink-950 shadow-sm' : 'border border-gold-400/25 text-stone-300 hover:bg-gold-400/10'}`}
              >
                {c.label} <span className={filter === c.key ? 'text-ink-950/70' : 'text-stone-500'}>({counts[c.key]})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {subs && subs.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('admin.noSubscribers')}</div>
      ) : shown.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('common.noResults')}</div>
      ) : (
        <div className="space-y-3">
          {shown.map((s) => (
            <SubRow
              key={s.email}
              s={s}
              onDeleted={(email) => setSubs((prev) => prev.filter((x) => x.email !== email))}
              onUpdated={(email, patch) => setSubs((prev) => prev.map((x) => (x.email === email ? { ...x, ...patch } : x)))}
              onOpen={setOpenSlug}
            />
          ))}
        </div>
      )}

      {openSlug && <AdminStoreDetail slug={openSlug} onClose={() => setOpenSlug('')} />}
    </div>
  );
}
