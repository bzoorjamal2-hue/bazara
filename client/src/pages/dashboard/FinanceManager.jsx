import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import useSessionState from '../../hooks/useSessionState.js';
import useScrollLock from '../../hooks/useScrollLock.js';
import modalRoot from '../../utils/modalRoot.js';
import { CashIcon, PlusIcon, TrashIcon, CheckIcon, BagIcon, TruckIcon, MegaphoneIcon, PackageIcon, HomeIcon, UsersIcon, NoteIcon, WarnIcon, DownloadIcon, ClockIcon, XIcon, BackIcon, ForwardIcon, ChartIcon, HelpIcon } from '../../components/icons.jsx';
import { PageHead, Tip, DateInput } from '../../components/FormField.jsx';
import { downloadXlsx } from '../../utils/xlsx.js';

// ═════ الأرباح والمصاريف ═════
// كانت الصفحةُ عموداً واحداً طويلاً: كشفٌ ثمّ تسويةٌ ثمّ نموذجٌ ثمّ سجلّ — والتاجرةُ التي
// تريدُ تسجيلَ ٥٠ شيكل أكياس تمرُّ بكلِّ الأرقامِ قبلها. صارت ثلاثةَ أسئلةٍ بثلاثةِ تبويبات:
// «كم ربحت؟» (الكشف)، «وين فلوسي؟» (التحصيل)، «شو صرفت؟» (المصاريف). وفوقها جوابٌ
// بجملةٍ عاديّةٍ وشريطٌ يُري أين ذهب كلُّ شيكلٍ من المبيعات.

// فئات المصاريف — نفس مفاتيح الخادم
const CATEGORIES = [
  { key: 'ads', Icon: MegaphoneIcon },
  { key: 'packaging', Icon: PackageIcon },
  { key: 'shipping', Icon: TruckIcon },
  { key: 'goods', Icon: BagIcon },
  { key: 'rent', Icon: HomeIcon },
  { key: 'salaries', Icon: UsersIcon },
  { key: 'other', Icon: NoteIcon },
];
const catIcon = (k) => (CATEGORIES.find((c) => c.key === k) || CATEGORIES[CATEGORIES.length - 1]).Icon;

const TABS = ['statement', 'collect', 'expenses'];
const QUICK = [50, 100, 200, 500];

const pad = (n) => String(n).padStart(2, '0');
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const shiftMonth = (m, by) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); };

export default function FinanceManager() {
  const { t, i18n } = useTranslation();
  // أرقامٌ لاتينيّة بالتواريخ كما بالمبالغ: «٢٨ أيلول» جنب «₪260» تبدو من خطّين
  const lang = i18n.language === 'en' ? 'en-GB' : 'ar-PS-u-nu-latn';
  const [month, setMonth] = useSessionState('finance:month', thisMonth());
  const [tab, setTab] = useSessionState('finance:tab', 'statement');
  const [data, setData] = useState(null);
  const [settle, setSettle] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null); // { text, undo?: () => void }
  const [sheet, setSheet] = useState(null); // نموذج المصروف المفتوح (قيمه الأولى)
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmCollect, setConfirmCollect] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const toastTimer = useRef(null);

  const load = useCallback((m) => {
    setError('');
    api.get(`/finance?month=${m}`).then((r) => setData(r.data)).catch((e) => setError(getErrorMessage(e)));
    // التسوية مستقلّة: فشلها لا يمنع ظهور كشف الشهر
    api.get(`/finance/couriers?month=${m}`).then((r) => { setSettle(r.data); setPicked(new Set()); }).catch(() => setSettle(null));
  }, []);
  useEffect(() => { load(month); }, [load, month]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (text, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 6000 : 2200);
  };

  const cur = t('common.currency');
  const money = (n) => `${cur}${Math.round(Math.abs(Number(n || 0))).toLocaleString('en-US')}`;
  const signed = (n) => `${n < 0 ? '−' : ''}${money(n)}`;
  const monthName = (m, opts = { month: 'long', year: 'numeric' }) => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(lang, opts);
  };
  const isNow = month === thisMonth();

  // ── المصاريف ──
  const openSheet = (init = {}) => setSheet({
    category: 'ads', amount: '', note: '',
    // شهرٌ سابقٌ مفتوح؟ التاريخُ الافتراضيُّ أوّلُه، فيقعُ المصروفُ حيث تنظرُ التاجرة
    spentAt: isNow ? todayStr() : `${month}-01`,
    ...init,
  });

  const saveExpense = async (form) => {
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return t('finance.needAmount');
    setBusy(true);
    try {
      await api.post('/finance/expenses', { ...form, amount });
      setSheet(null);
      showToast(t('finance.added'));
      const m = form.spentAt.slice(0, 7);
      if (m !== month) setMonth(m); else load(month);
      return '';
    } catch (e) {
      return getErrorMessage(e);
    } finally {
      setBusy(false);
    }
  };

  const doRemove = async () => {
    const x = confirmDel;
    if (!x) return;
    setConfirmDel(null);
    try { await api.delete(`/finance/expenses/${x.id}`); load(month); showToast(t('finance.deleted')); } catch (e) { setError(getErrorMessage(e)); }
  };

  // ── التحصيل ──
  const togglePick = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const collect = async (body) => {
    setBusy(true); setError('');
    try {
      const r = await api.post('/finance/collect', body);
      const ids = r.data.ids || [];
      showToast(t('finance.collectedCount', { count: r.data.count }), ids.length ? async () => {
        setToast(null);
        try { await api.post('/finance/uncollect', { orderIds: ids }); load(month); } catch (e) { setError(getErrorMessage(e)); }
      } : null);
      load(month);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
      setConfirmCollect(null);
    }
  };

  // تصدير كشف الشهر: ورقة ملخّص + ورقة مصاريف مفصّلة
  const exportMonth = () => {
    if (!data) return;
    const catLabel = (k) => t(`finance.cat.${k}`);
    downloadXlsx([
      {
        name: t('finance.sheetSummary'),
        columns: [{ header: t('finance.item'), width: 28 }, { header: t('finance.amount'), width: 16, type: 'money' }],
        rows: [
          [t('dashboard.analytics.revenue'), data.revenue],
          [t('finance.cogs'), -data.cogs],
          [t('finance.deliveryFees'), -data.deliveryFees],
          [t('dashboard.analytics.profit'), data.productProfit],
          ['', ''],
          ...CATEGORIES.filter((c) => data.expensesByCategory[c.key]).map((c) => [catLabel(c.key), -data.expensesByCategory[c.key]]),
          [t('finance.expensesTotal'), -data.expensesTotal],
          ['', ''],
          [t('finance.netProfit'), data.netProfit],
        ],
      },
      {
        name: t('finance.sheetExpenses'),
        columns: [
          { header: t('dashboard.ordersSection.date'), width: 14 },
          { header: t('finance.category'), width: 18 },
          { header: t('finance.amount'), width: 14, type: 'money' },
          { header: t('finance.note'), width: 34 },
        ],
        rows: data.expenses.map((e) => [new Date(e.spentAt).toLocaleDateString(lang), catLabel(e.category), e.amount, e.note]),
      },
    ], `bazara-finance-${data.month}`);
  };

  if (!data && !error) return <Spinner />;

  const pendingAmount = settle?.totals?.pendingAmount || 0;
  const tabBadge = { collect: settle?.totals?.pendingOrders || 0, expenses: data?.expenses?.length || 0 };

  return (
    <div className="bz-fin space-y-4">
      <PageHead
        icon={<CashIcon className="h-6 w-6" />}
        title={t('finance.title')}
        hint={t('finance.hint')}
      />

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}

      {/* ── الشهر: سهمان بدل قائمةٍ منسدلة — «الشهر الماضي» ضغطةٌ واحدة ── */}
      <div className="bz-fin-month flex items-center justify-between gap-2 rounded-2xl p-1.5">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t('finance.prevMonth')} className="bz-fin-arrow app-tap grid h-10 w-10 place-items-center rounded-xl">
          <BackIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-[15px] font-extrabold">{monthName(month)}</p>
          {isNow
            ? <p className="bz-fin-muted text-[11px]">{t('finance.thisMonth')}</p>
            : <button type="button" onClick={() => setMonth(thisMonth())} className="text-[11px] font-bold underline-offset-2 hover:underline">{t('finance.backToNow')}</button>}
        </div>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={isNow} aria-label={t('finance.nextMonth')} className="bz-fin-arrow app-tap grid h-10 w-10 place-items-center rounded-xl disabled:opacity-30">
          <ForwardIcon className="h-5 w-5" />
        </button>
      </div>

      {data && (
        <>
          <Hero data={data} money={money} signed={signed} monthName={monthName(month, { month: 'long' })} t={t} />

          {pendingAmount > 0 && tab !== 'collect' && (
            <button type="button" onClick={() => setTab('collect')} className="bz-fin-alert app-tap flex w-full items-center gap-3 rounded-2xl p-3.5 text-start">
              <span className="bz-fin-alert-ico grid h-10 w-10 shrink-0 place-items-center rounded-xl"><TruckIcon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{t('finance.atCourierAlert', { amount: money(pendingAmount) })}</span>
                <span className="bz-fin-muted block text-[12px]">{t('finance.atCourierAlertHint')}</span>
              </span>
              <ForwardIcon className="h-4 w-4 shrink-0 opacity-60" />
            </button>
          )}

          {/* ── التبويبات ── */}
          <div className="bz-fin-tabs grid grid-cols-3 gap-1 rounded-2xl p-1" role="tablist">
            {TABS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`bz-fin-tab app-tap flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[13px] font-bold ${tab === k ? 'is-on' : ''}`}
              >
                {t(`finance.tabs.${k}`)}
                {tabBadge[k] > 0 && <span className={`bz-fin-badge tabular-nums ${k === 'collect' ? 'is-warn' : ''}`}>{tabBadge[k]}</span>}
              </button>
            ))}
          </div>

          {tab === 'statement' && <Statement data={data} money={money} signed={signed} monthName={monthName} month={month} setMonth={setMonth} t={t} onExport={exportMonth} />}

          {tab === 'collect' && (
            <Collect
              settle={settle} money={money} lang={lang} t={t} busy={busy}
              picked={picked} togglePick={togglePick} setPicked={setPicked}
              onCollectPicked={() => collect({ orderIds: [...picked] })}
              onSettleCourier={(c) => setConfirmCollect({ courier: c.key, count: c.pendingOrders, amount: c.pendingAmount })}
            />
          )}

          {tab === 'expenses' && (
            <Expenses
              data={data} money={money} lang={lang} t={t}
              onAdd={openSheet} onDelete={setConfirmDel}
            />
          )}
        </>
      )}


      {sheet && <ExpenseSheet init={sheet} busy={busy} onClose={() => setSheet(null)} onSave={saveExpense} t={t} cur={cur} />}

      {toast && (
        <div className="bz-fin-toast fixed inset-x-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 100px)' }} role="status">
          <CheckIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{toast.text}</span>
          {toast.undo && <button type="button" onClick={toast.undo} className="shrink-0 font-extrabold underline underline-offset-2">{t('finance.undo')}</button>}
        </div>
      )}

      <ConfirmModal
        open={!!confirmCollect}
        title={t('finance.settleTitle')}
        message={confirmCollect ? t('finance.settleConfirm', { count: confirmCollect.count, courier: t(`finance.courier.${confirmCollect.courier}`), amount: money(confirmCollect.amount) }) : ''}
        confirmLabel={t('finance.settleAll')}
        onConfirm={() => collect({ courier: confirmCollect.courier })}
        onCancel={() => setConfirmCollect(null)}
      />

      <ConfirmModal
        open={!!confirmDel}
        title={t('finance.deleteTitle')}
        message={confirmDel ? `${t('finance.deleteConfirm')}\n${t(`finance.cat.${confirmDel.category}`)} — ${money(confirmDel.amount)}` : ''}
        confirmLabel={t('common.delete')}
        onConfirm={doRemove}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

// ═════ الرقمُ الكبير + جملتُه + شريطُ «وين راحت الفلوس» ═════
function Hero({ data, money, signed, monthName, t }) {
  const net = data.netProfit;
  const loss = net < 0;
  // كلُّ مبلغٍ معزولُ الاتّجاه (FSI…PDI): «₪450» اللاتينيّةُ آخرَ جملةٍ عربيّةٍ تسحبُ النقطةَ لأوّلِها
  const iso = (x) => `\u2068${x}\u2069`;
  const story = data.revenue <= 0
    ? t('finance.storyEmpty')
    : loss
      ? t('finance.storyLoss', { revenue: iso(money(data.revenue)), loss: iso(money(net)) })
      : t('finance.storyProfit', { revenue: iso(money(data.revenue)), count: data.ordersCount, net: iso(money(net)), keep: Math.max(0, data.margin ?? 0) });

  // الشريط: المبيعاتُ كلُّها مقسومةً على أين ذهبت. والخسارةُ تُقاسُ على مجموعِ ما خرج
  // لا على المبيعات — فيظهرُ أنّ الخارجَ أكبرُ من الداخل.
  const parts = [
    { k: 'profit', v: Math.max(net, 0) },
    { k: 'cogs', v: data.cogs },
    { k: 'ship', v: data.deliveryFees },
    { k: 'exp', v: data.expensesTotal },
  ];
  const whole = Math.max(data.revenue, data.cogs + data.deliveryFees + data.expensesTotal, 1);
  const showBar = data.revenue > 0 || data.expensesTotal > 0;

  return (
    <div className="bz-fin-hero overflow-hidden rounded-3xl p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="bz-fin-muted flex items-center gap-1.5 text-[13px] font-semibold">
          {t('finance.netIn', { month: monthName })} <Tip text={t('finance.netTip')} />
        </p>
        <span className={`bz-fin-state inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${loss ? 'is-loss' : 'is-gain'}`}>
          {loss ? <WarnIcon className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
          {loss ? t('finance.stateLoss') : t('finance.stateGain')}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display text-[44px] font-extrabold leading-tight tabular-nums" dir="ltr">{signed(net)}</p>
        {data.netChange != null && (
          <span className={`bz-fin-delta inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${data.netChange >= 0 ? 'is-up' : 'is-down'}`}>
            {data.netChange >= 0 ? '▲' : '▼'} {Math.abs(data.netChange)}% <span className="font-medium opacity-80">{t('finance.vsPrev')}</span>
          </span>
        )}
      </div>
      <p className="mt-2 text-[14px] leading-relaxed">{story}</p>

      {showBar && (
        <div className="mt-4">
          <p className="bz-fin-muted mb-2 text-[12px] font-semibold">{t('finance.whereTitle')}</p>
          <div className="bz-fin-bar flex h-4 w-full overflow-hidden rounded-full" role="img" aria-label={t('finance.whereTitle')}>
            {parts.filter((p) => p.v > 0).map((p) => (
              <span key={p.k} className={`bz-fin-seg is-${p.k}`} style={{ width: `${(p.v / whole) * 100}%` }} title={`${t(`finance.part.${p.k}`)} · ${money(p.v)}`} />
            ))}
          </div>
          {/* المفتاحُ بالقيمِ نفسِها: اللونُ لا يحملُ المعنى وحدَه */}
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {parts.map((p) => (
              <li key={p.k} className="flex min-w-0 items-center gap-2 text-[12.5px]">
                <span className={`bz-fin-dot is-${p.k} h-2.5 w-2.5 shrink-0 rounded-full`} />
                <span className="bz-fin-muted min-w-0 flex-1 truncate">{t(`finance.part.${p.k}`)}</span>
                <span className="shrink-0 font-bold tabular-nums">{money(p.v)}</span>
              </li>
            ))}
          </ul>
          {loss && <p className="bz-fin-lossnote mt-3 rounded-xl px-3 py-2 text-[12px] font-semibold">{t('finance.lossNote', { amount: iso(money(net)) })}</p>}
        </div>
      )}
    </div>
  );
}

// ═════ الكشف: من المبيعات إلى صافي الربح، خطوةً خطوة ═════
function Statement({ data, money, signed, monthName, month, setMonth, t, onExport }) {
  const steps = [
    { op: '+', label: t('finance.lineSales'), hint: t('finance.lineSalesHint', { count: data.ordersCount }), v: data.revenue, tip: t('finance.revenueTip') },
    { op: '−', label: t('finance.cogs'), hint: t('finance.lineCogsHint'), v: data.cogs, tip: t('finance.cogsTip') },
    { op: '−', label: t('finance.deliveryFees'), hint: t('finance.lineShipHint'), v: data.deliveryFees, tip: t('finance.deliveryTip') },
    { op: '=', label: t('dashboard.analytics.profit'), v: data.productProfit, sub: true },
    { op: '−', label: t('finance.expensesTotal'), hint: t('finance.lineExpHint'), v: data.expensesTotal, tip: t('finance.expensesTip') },
  ];
  const peak = Math.max(...(data.trend || []).map((x) => Math.abs(x.netProfit)), 1);
  return (
    <div className="space-y-4">
      <div className="bz-fin-card overflow-hidden rounded-3xl">
        {steps.map((s, i) => (
          <div key={i} className={`bz-fin-line flex items-center gap-3 px-4 py-3 ${s.sub ? 'is-sub' : ''}`}>
            <span className={`bz-fin-op grid h-8 w-8 shrink-0 place-items-center rounded-full text-base font-extrabold ${s.op === '−' ? 'is-minus' : s.op === '+' ? 'is-plus' : ''}`}>{s.op}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[14px] font-bold">{s.label}{s.tip && <Tip text={s.tip} />}</p>
              {s.hint && <p className="bz-fin-muted truncate text-[11.5px]">{s.hint}</p>}
            </div>
            <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{money(s.v)}</span>
          </div>
        ))}
        <div className="bz-fin-total flex items-center gap-3 px-4 py-4">
          <span className="bz-fin-op is-eq grid h-8 w-8 shrink-0 place-items-center rounded-full text-base font-extrabold">=</span>
          <p className="min-w-0 flex-1 text-[15px] font-extrabold">{t('finance.netProfit')}</p>
          <span className="shrink-0 font-display text-xl font-extrabold tabular-nums" dir="ltr">{signed(data.netProfit)}</span>
        </div>
        {data.margin != null && (
          <p className="bz-fin-muted flex items-center gap-1.5 px-4 pb-3.5 text-[12px]">
            {t('finance.marginLine', { pct: data.margin })} <Tip text={t('finance.marginTip')} />
          </p>
        )}
      </div>

      {/* صدق الأرقام — مع زرّ الحلّ لا تحذيرٌ وحده */}
      {data.profitMissing > 0 && (
        <div className="bz-fin-warn flex items-start gap-3 rounded-2xl p-3.5">
          <WarnIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">{t('finance.missingNote', { count: data.profitMissing })}</p>
            <p className="mt-0.5 text-[12px] opacity-80">{t('finance.missingHint')}</p>
            <Link to="/dashboard?tab=myProducts" className="bz-fin-warn-btn mt-2 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-extrabold">
              {t('finance.fixCostsBtn')} <ForwardIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
      {data.profitEstimated > 0 && (
        <p className="bz-fin-muted flex items-start gap-1.5 px-1 text-[11.5px] leading-relaxed">
          <HelpIcon className="mt-px h-3.5 w-3.5 shrink-0" /> {t('finance.estimatedNote', { count: data.profitEstimated })}
        </p>
      )}

      {/* اتجاه ستة أشهر: العمودُ يُضغَطُ فينتقلُ الكشفُ إلى شهرِه */}
      {data.trend?.length > 1 && data.trend.some((m) => m.netProfit !== 0) && (
        <div className="bz-fin-card rounded-3xl p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[13px] font-bold"><ChartIcon className="h-4 w-4" /> {t('finance.trendTitle2')}</p>
            <p className="bz-fin-muted text-[11px]">{t('finance.trendTap')}</p>
          </div>
          <div className="flex items-end gap-2" style={{ height: 136 }}>
            {data.trend.map((m) => {
              const h = Math.max(Math.round((Math.abs(m.netProfit) / peak) * 78), 4);
              const neg = m.netProfit < 0;
              const on = m.month === month;
              const k = Math.abs(m.netProfit) >= 1000 ? `${(Math.abs(m.netProfit) / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(Math.abs(m.netProfit))}`;
              return (
                <button
                  key={m.month}
                  type="button"
                  onClick={() => setMonth(m.month)}
                  aria-label={`${monthName(m.month)}: ${signed(m.netProfit)}`}
                  aria-pressed={on}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className={`text-[10.5px] tabular-nums ${on ? 'font-extrabold' : 'bz-fin-muted'}`} dir="ltr">{neg ? '−' : ''}{k}</span>
                  <span className={`bz-fin-tbar w-full max-w-[34px] rounded-t-md rounded-b-[3px] ${neg ? 'is-neg' : ''} ${on ? 'is-on' : ''}`} style={{ height: h }} />
                  <span className={`flex min-h-[26px] w-full items-start justify-center text-center text-[10px] leading-tight ${on ? 'font-extrabold' : 'bz-fin-muted'}`}>{monthName(m.month, { month: 'short' })}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button type="button" onClick={onExport} className="bz-fin-ghost app-tap flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-bold">
        <DownloadIcon className="h-4 w-4" /> {t('finance.exportMonth')}
      </button>
    </div>
  );
}

// ═════ التحصيل: وين فلوسي؟ ═════
function Collect({ settle, money, lang, t, busy, picked, togglePick, setPicked, onCollectPicked, onSettleCourier }) {
  if (!settle) return <p className="bz-fin-muted py-10 text-center text-sm">{t('finance.collectNone')}</p>;
  const { totals } = settle;
  const flow = [
    { k: 'transit', Icon: TruckIcon, v: totals.transitAmount, label: t('finance.inTransit') },
    { k: 'pending', Icon: ClockIcon, v: totals.pendingAmount, label: t('finance.atCourier') },
    { k: 'done', Icon: CheckIcon, v: totals.collectedAmount, label: t('finance.collected') },
  ];
  const empty = !settle.couriers.length && !settle.pending.length;
  const allPicked = settle.pending.length > 0 && settle.pending.every((o) => picked.has(o.id));
  return (
    <div className="space-y-4">
      {/* المسار بثلاث محطّات: الطلبُ يمشي من اليمين لليسار حتى يصيرَ مالاً بيدِك */}
      <div className="bz-fin-card rounded-3xl p-4">
        <p className="text-[13px] font-bold">{t('finance.flowTitle')}</p>
        <p className="bz-fin-muted mb-3 text-[11.5px]">{t('finance.flowHint')}</p>
        <div className="flex items-stretch gap-1.5">
          {flow.map((f, i) => (
            <div key={f.k} className="flex min-w-0 flex-1 items-center gap-1.5">
              <div className={`bz-fin-flow is-${f.k} min-w-0 flex-1 rounded-2xl px-2 py-3 text-center`}>
                <f.Icon className="mx-auto h-5 w-5" />
                <p className="mt-1 whitespace-nowrap text-[11px] font-semibold">{f.label}</p>
                <p className="mt-0.5 truncate font-display text-[16px] font-extrabold tabular-nums">{money(f.v)}</p>
              </div>
              {i < flow.length - 1 && <ForwardIcon className="bz-fin-muted h-4 w-4 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {empty ? (
        <div className="bz-fin-card flex flex-col items-center gap-2 rounded-3xl p-8 text-center">
          <TruckIcon className="h-8 w-8 opacity-60" />
          <p className="text-sm font-bold">{t('finance.collectEmpty')}</p>
          <p className="bz-fin-muted max-w-xs text-[12.5px]">{t('finance.collectEmptyHint')}</p>
        </div>
      ) : (
        <>
          {settle.couriers.map((c) => (
            <div key={c.key} className="bz-fin-card rounded-3xl p-4">
              <div className="flex items-center gap-3">
                <span className="bz-fin-icotile grid h-11 w-11 shrink-0 place-items-center rounded-2xl"><TruckIcon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-extrabold">{t(`finance.courier.${c.key}`)}</p>
                  <p className="bz-fin-muted text-[12px]">
                    {c.pendingOrders > 0
                      ? t('finance.courierOwes', { amount: money(c.pendingAmount), count: c.pendingOrders })
                      : t('finance.courierClear')}
                  </p>
                </div>
              </div>
              <div className="bz-fin-mini mt-3 grid grid-cols-3 overflow-hidden rounded-2xl text-center">
                <Mini label={t('finance.inTransit')} value={money(c.transitAmount)} count={c.transitOrders} t={t} />
                <Mini label={t('finance.atCourier')} value={money(c.pendingAmount)} count={c.pendingOrders} t={t} strong={c.pendingOrders > 0} />
                <Mini label={t('finance.collected')} value={money(c.collectedAmount)} count={c.collectedOrders} t={t} />
              </div>
              {c.pendingOrders > 0 && (
                <button type="button" onClick={() => onSettleCourier(c)} disabled={busy} className="bz-fin-primary app-tap mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold disabled:opacity-50">
                  <CheckIcon className="h-4 w-4" /> {t('finance.gotTransfer', { amount: money(c.pendingAmount) })}
                </button>
              )}
            </div>
          ))}

          {settle.pending.length > 0 && (
            <div className="bz-fin-card overflow-hidden rounded-3xl">
              <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                <div>
                  <p className="text-[13px] font-bold">{t('finance.pendingList', { count: settle.pending.length })}</p>
                  <p className="bz-fin-muted text-[11.5px]">{t('finance.pendingHint')}</p>
                </div>
                <button type="button" onClick={() => setPicked(allPicked ? new Set() : new Set(settle.pending.map((o) => o.id)))} className="shrink-0 text-[12px] font-bold underline-offset-2 hover:underline">
                  {allPicked ? t('dashboard.ordersSection.selectNone') : t('dashboard.ordersSection.selectAll')}
                </button>
              </div>
              <ul>
                {settle.pending.map((o) => {
                  const on = picked.has(o.id);
                  const days = Math.max(0, Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 86400000));
                  return (
                    <li key={o.id}>
                      <button type="button" onClick={() => togglePick(o.id)} aria-pressed={on} className={`bz-fin-row flex w-full items-center gap-3 px-4 py-3 text-start ${on ? 'is-on' : ''}`}>
                        <span className={`bz-ocheck ${on ? 'is-on' : ''} grid h-6 w-6 shrink-0 place-items-center rounded-full`}>{on && <CheckIcon className="h-3.5 w-3.5" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold">{o.customerName || t('finance.noName')}</span>
                          {/* كلُّ قطعةٍ معزولةُ الاتّجاه: رقمُ الطلبِ وEPS لاتينيّان والتاريخُ أرقام —
                              كانت تتشابكُ بسطرٍ عربيٍّ فيقرأُ «2026/10/BZ-2LP0 · EPS · 1» */}
                          <span className="bz-fin-muted mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px]">
                            <bdi>{t(`finance.courier.${o.courier}`)}</bdi><span>·</span>
                            <bdi dir="ltr">{o.reference || '—'}</bdi><span>·</span>
                            <bdi>{new Date(o.createdAt).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}</bdi>
                            {days >= 7 && <span className="bz-fin-late rounded-full px-1.5 font-bold">{t('finance.waitingDays', { count: days })}</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{money(o.total)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {picked.size > 0 && (
                <div className="p-3">
                  <button type="button" onClick={onCollectPicked} disabled={busy} className="bz-fin-primary app-tap flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold disabled:opacity-50">
                    <CheckIcon className="h-4 w-4" />
                    {t('finance.collectPickedSum', {
                      count: picked.size,
                      amount: money(settle.pending.filter((o) => picked.has(o.id)).reduce((n, o) => n + o.total, 0)),
                    })}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Mini({ label, value, count, strong, t }) {
  return (
    <div className="bz-fin-minicell px-1 py-2.5">
      <p className="bz-fin-muted text-[10.5px]">{label}</p>
      <p className={`mt-0.5 text-[13.5px] tabular-nums ${strong ? 'bz-fin-strong font-extrabold' : 'font-bold'}`}>{value}</p>
      <p className="bz-fin-muted text-[10.5px]">{t('finance.ordersN', { count })}</p>
    </div>
  );
}

// ═════ المصاريف ═════
function Expenses({ data, money, lang, t, onAdd, onDelete }) {
  const cats = CATEGORIES.filter((c) => data.expensesByCategory[c.key]).sort((a, b) => data.expensesByCategory[b.key] - data.expensesByCategory[a.key]);
  const top = cats.length ? data.expensesByCategory[cats[0].key] : 1;
  // السجلُّ مجمّعٌ باليوم — «شو صرفت مبارح؟» تُقرأُ بلمحة
  const groups = [];
  for (const e of data.expenses) {
    const k = new Date(e.spentAt).toDateString();
    const g = groups[groups.length - 1];
    if (g && g.k === k) g.items.push(e); else groups.push({ k, date: e.spentAt, items: [e] });
  }
  return (
    <div className="space-y-4">
      {data.expenses.length > 0 && (
        <button type="button" onClick={() => onAdd()} className="bz-fin-primary app-tap flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-extrabold">
          <PlusIcon className="h-5 w-5" /> {t('finance.addTitle')}
        </button>
      )}
      {data.recurring?.length > 0 && (
        <div className="bz-fin-card rounded-3xl p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-bold">{t('finance.recurringTitle2')} <Tip text={t('finance.recurringTip')} /></p>
          <div className="mt-3 space-y-2">
            {data.recurring.map((rc) => {
              const Icon = catIcon(rc.category);
              return (
                <div key={`${rc.category}-${rc.amount}`} className="bz-fin-sug flex items-center gap-3 rounded-2xl p-2.5">
                  <span className="bz-fin-icotile grid h-10 w-10 shrink-0 place-items-center rounded-xl"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold">{t(`finance.cat.${rc.category}`)} · <span className="tabular-nums">{money(rc.amount)}</span></span>
                    {rc.note && <span className="bz-fin-muted block truncate text-[11.5px]">{rc.note}</span>}
                  </span>
                  <button type="button" onClick={() => onAdd({ category: rc.category, amount: String(rc.amount), note: rc.note })} className="bz-fin-ghost app-tap shrink-0 rounded-xl px-3 py-2 text-[12px] font-extrabold">
                    {t('finance.recordAgain')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.expenses.length === 0 ? (
        <div className="bz-fin-card flex flex-col items-center gap-2 rounded-3xl p-8 text-center">
          <CashIcon className="h-8 w-8 opacity-60" />
          <p className="text-sm font-bold">{t('finance.noExpenses')}</p>
          <p className="bz-fin-muted max-w-xs text-[12.5px]">{t('finance.noExpensesHint')}</p>
          <button type="button" onClick={() => onAdd()} className="bz-fin-primary app-tap mt-2 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold">
            <PlusIcon className="h-4 w-4" /> {t('finance.addFirst')}
          </button>
        </div>
      ) : (
        <>
          {/* وين بتروح المصاريف: عمودٌ لكلِّ بند، الأكبرُ أوّلاً */}
          <div className="bz-fin-card rounded-3xl p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-bold">{t('finance.byCatTitle')}</p>
              <p className="font-display text-[17px] font-extrabold tabular-nums">{money(data.expensesTotal)}</p>
            </div>
            <ul className="mt-3 space-y-3">
              {cats.map((c) => {
                const amount = data.expensesByCategory[c.key];
                const pct = data.expensesTotal > 0 ? Math.round((amount / data.expensesTotal) * 100) : 0;
                return (
                  <li key={c.key} className="flex items-center gap-3">
                    <span className="bz-fin-icotile grid h-9 w-9 shrink-0 place-items-center rounded-xl"><c.Icon className="h-[18px] w-[18px]" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="font-bold">{t(`finance.cat.${c.key}`)}</span>
                        <span className="tabular-nums"><b>{money(amount)}</b> <span className="bz-fin-muted">· {pct}%</span></span>
                      </div>
                      <div className="bz-fin-track mt-1.5 h-2 overflow-hidden rounded-full">
                        <div className="bz-fin-fill h-full rounded-full" style={{ width: `${Math.max((amount / top) * 100, 4)}%` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="bz-fin-card overflow-hidden rounded-3xl">
            {groups.map((g) => (
              <div key={g.k}>
                <p className="bz-fin-day px-4 py-2 text-[11.5px] font-bold">{new Date(g.date).toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                {g.items.map((e) => {
                  const Icon = catIcon(e.category);
                  return (
                    <div key={e.id} className="bz-fin-row flex items-center gap-3 px-4 py-3">
                      <span className="bz-fin-icotile grid h-10 w-10 shrink-0 place-items-center rounded-xl"><Icon className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold">{t(`finance.cat.${e.category}`)}</p>
                        {e.note && <p className="bz-fin-muted truncate text-[12px]">{e.note}</p>}
                      </div>
                      <span className="shrink-0 text-[15px] font-extrabold tabular-nums">{money(e.amount)}</span>
                      <button type="button" onClick={() => onDelete(e)} title={t('common.delete')} aria-label={t('common.delete')} className="bz-fin-del grid h-9 w-9 shrink-0 place-items-center rounded-xl">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═════ تسجيلُ مصروف: ورقةٌ من الأسفل — بند بأيقونة، مبلغ كبير، تاريخ بضغطة ═════
function ExpenseSheet({ init, busy, onClose, onSave, t, cur }) {
  const [form, setForm] = useState(init);
  const [err, setErr] = useState('');
  const [pickDate, setPickDate] = useState(() => ![todayStr(), yesterdayStr()].includes(init.spentAt));
  const amountRef = useRef(null);
  useScrollLock(true);
  useEffect(() => {
    const id = setTimeout(() => amountRef.current?.focus({ preventScroll: true }), 250);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const set = (patch) => { setErr(''); setForm((f) => ({ ...f, ...patch })); };
  const submit = async (e) => {
    e.preventDefault();
    const msg = await onSave(form);
    if (msg) setErr(msg);
  };
  const addQuick = (n) => set({ amount: String((parseFloat(form.amount) || 0) + n) });

  return createPortal(
    <div className="fixed inset-0 z-[105] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={t('finance.addTitle')}>
      <button type="button" aria-label={t('common.cancel')} onClick={onClose} className="bz-sheet-backdrop absolute inset-0" />
      <form onSubmit={submit} className="bz-sheet bz-fin-sheet relative mx-auto flex max-h-[92%] w-full max-w-lg flex-col rounded-t-3xl pb-[max(env(safe-area-inset-bottom),14px)]">
        <span className="bz-sheet-grip mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full" aria-hidden />
        <div className="flex shrink-0 items-center gap-2 px-5 pb-1 pt-3">
          <p className="flex-1 text-[17px] font-extrabold">{t('finance.addTitle')}</p>
          <button type="button" onClick={onClose} className="rounded-full p-1.5" aria-label={t('common.cancel')}><XIcon className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-5 pb-2 pt-2">
          {/* المبلغ أوّلاً وكبيراً: هو ما في رأسها */}
          <div>
            <label className="bz-sheet-muted text-[12px] font-bold" htmlFor="bz-fin-amount">{t('finance.amount')}</label>
            <div className="bz-fin-amount mt-1 flex items-center gap-2 rounded-2xl px-4">
              <input
                id="bz-fin-amount"
                ref={amountRef}
                type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
                className="min-w-0 flex-1 bg-transparent py-3 font-display text-[34px] font-extrabold tabular-nums focus:outline-none"
                value={form.amount}
                onChange={(e) => set({ amount: e.target.value })}
              />
              <span className="text-2xl font-extrabold opacity-50">{cur}</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {QUICK.map((n) => (
                <button key={n} type="button" onClick={() => addQuick(n)} className="bz-fin-chip app-tap flex-1 rounded-xl py-2 text-[12.5px] font-bold tabular-nums">+{n}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="bz-sheet-muted text-[12px] font-bold">{t('finance.category')}</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => {
                const on = form.category === c.key;
                return (
                  <button key={c.key} type="button" onClick={() => set({ category: c.key })} aria-pressed={on} className={`bz-fin-cat app-tap flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-[11.5px] font-bold ${on ? 'is-on' : ''}`}>
                    <c.Icon className="h-5 w-5" />
                    <span className="leading-tight">{t(`finance.cat.${c.key}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="bz-sheet-muted text-[12px] font-bold">{t('finance.spentAt')}</p>
            <div className="mt-2 flex gap-1.5">
              <button type="button" onClick={() => { setPickDate(false); set({ spentAt: todayStr() }); }} className={`bz-fin-chip app-tap flex-1 rounded-xl py-2 text-[12.5px] font-bold ${!pickDate && form.spentAt === todayStr() ? 'is-on' : ''}`}>{t('finance.today')}</button>
              <button type="button" onClick={() => { setPickDate(false); set({ spentAt: yesterdayStr() }); }} className={`bz-fin-chip app-tap flex-1 rounded-xl py-2 text-[12.5px] font-bold ${!pickDate && form.spentAt === yesterdayStr() ? 'is-on' : ''}`}>{t('finance.yesterday')}</button>
              <button type="button" onClick={() => setPickDate(true)} className={`bz-fin-chip app-tap flex-1 rounded-xl py-2 text-[12.5px] font-bold ${pickDate ? 'is-on' : ''}`}>{t('finance.otherDay')}</button>
            </div>
            {pickDate && <div className="mt-2"><DateInput value={form.spentAt} onChange={(v) => set({ spentAt: v || todayStr() })} /></div>}
          </div>

          <div>
            <label className="bz-sheet-muted text-[12px] font-bold" htmlFor="bz-fin-note">{t('finance.note')} <span className="font-normal">({t('finance.optional')})</span></label>
            <input id="bz-fin-note" type="text" maxLength={200} className="bz-sheet-input mt-1 w-full rounded-xl py-2.5" placeholder={t('finance.notePlaceholder')} value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </div>

          {err && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-500">{err}</p>}
        </div>
        <div className="shrink-0 px-5 pt-2">
          <button type="submit" disabled={busy} className="bz-fin-primary app-tap flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-extrabold disabled:opacity-50">
            <CheckIcon className="h-5 w-5" /> {busy ? t('common.loading') : t('finance.save')}
          </button>
        </div>
      </form>
    </div>,
    modalRoot()
  );
}
