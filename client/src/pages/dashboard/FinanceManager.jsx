import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { CashIcon, ChartIcon, PlusIcon, TrashIcon, CheckIcon, BagIcon, TruckIcon, MegaphoneIcon, PackageIcon, HomeIcon, UsersIcon, NoteIcon, WarnIcon, DownloadIcon, ClockIcon } from '../../components/icons.jsx';
import { PageHead, SectionHead, Field, Tip } from '../../components/FormField.jsx';
import { downloadXlsx } from '../../utils/xlsx.js';

// فئات المصاريف — نفس مفاتيح الخادم
const CATEGORIES = [
  { key: 'ads', Icon: MegaphoneIcon },
  { key: 'packaging', Icon: PackageIcon },
  { key: 'shipping', Icon: TruckIcon },
  { key: 'rent', Icon: HomeIcon },
  { key: 'salaries', Icon: UsersIcon },
  { key: 'goods', Icon: BagIcon },
  { key: 'other', Icon: NoteIcon },
];

// آخر ١٢ شهراً كخيارات (YYYY-MM) — المالكة تفكّر بالشهر لا بالمدى المفتوح
function monthOptions(t, lang) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = i === 0 ? t('finance.thisMonth') : d.toLocaleDateString(lang, { month: 'long', year: 'numeric' });
    out.push({ value, label });
  }
  return out;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function FinanceManager() {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [form, setForm] = useState({ category: 'ads', amount: '', note: '', spentAt: todayStr() });
  const [settle, setSettle] = useState(null);   // تسوية شركات التوصيل
  const [picked, setPicked] = useState(() => new Set()); // طلبات مؤشَّرة للتحصيل
  const [confirmCollect, setConfirmCollect] = useState(null);

  const load = useCallback((m) => {
    setError('');
    api.get(`/finance?month=${m}`).then((r) => setData(r.data)).catch((e) => setError(getErrorMessage(e)));
    // التسوية مستقلّة: فشلها لا يمنع ظهور كشف الشهر
    api.get(`/finance/couriers?month=${m}`).then((r) => { setSettle(r.data); setPicked(new Set()); }).catch(() => setSettle(null));
  }, []);
  useEffect(() => { load(month); }, [load, month]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 1800); };
  const cur = t('common.currency');
  const money = (n) => `${cur}${Math.round(Number(n || 0)).toLocaleString()}`;

  const addExpense = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError(t('finance.needAmount')); return; }
    setBusy(true); setError('');
    try {
      await api.post('/finance/expenses', { ...form, amount });
      setForm({ category: form.category, amount: '', note: '', spentAt: form.spentAt });
      flash(t('finance.added'));
      load(month);
    } catch (e2) {
      setError(getErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const doRemove = async () => {
    const x = confirmDel;
    if (!x) return;
    setConfirmDel(null);
    try { await api.delete(`/finance/expenses/${x.id}`); load(month); } catch (e) { setError(getErrorMessage(e)); }
  };

  const togglePick = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const collect = async (body, label) => {
    setBusy(true); setError('');
    try {
      const r = await api.post('/finance/collect', body);
      flash(t('finance.collectedCount', { count: r.data.count }));
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
        rows: data.expenses.map((e) => [new Date(e.spentAt).toLocaleDateString(i18n.language), catLabel(e.category), e.amount, e.note]),
      },
    ], `bazara-finance-${data.month}`);
  };

  if (!data && !error) return <Spinner />;

  const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';
  const net = data?.netProfit ?? 0;
  const positive = net >= 0;

  return (
    <div className="space-y-5">
      <PageHead
        icon={<CashIcon className="h-6 w-6" />}
        title={t('finance.title')}
        hint={t('finance.hint')}
        action={data ? (
          <button onClick={exportMonth} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gold-400/30 px-3 py-2 text-sm font-semibold text-gold-200 transition hover:bg-gold-400/10">
            <DownloadIcon className="h-4 w-4" /> {t('dashboard.ordersSection.export')}
          </button>
        ) : null}
      />

      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
          <CheckIcon className="h-4 w-4 shrink-0" /> {msg}
        </div>
      )}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}

      {data && (
        <>
          {/* كشف الشهر */}
          <div className={CARD}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHead icon={<ChartIcon className="h-5 w-5" />} title={t('finance.statementTitle')} desc={t('finance.statementHint')} />
              <div className="w-44 shrink-0">
                <Select value={month} onChange={setMonth} className="!py-2 text-sm" options={monthOptions(t, i18n.language)} />
              </div>
            </div>

            {/* صافي الربح — الرقم الذي تبحث عنه المالكة */}
            <div className={`rounded-2xl border p-4 ${positive ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-red-400/30 bg-red-500/10'}`}>
              <p className="flex items-center gap-1.5 text-xs font-medium text-stone-400">
                {t('finance.netProfit')} <Tip text={t('finance.netTip')} />
              </p>
              <p className={`mt-1 font-display text-4xl font-extrabold tabular-nums ${positive ? 'text-emerald-400' : 'text-red-300'}`}>
                {money(net)}
              </p>
              <p className="mt-1 text-[11px] text-stone-400">{t('finance.netFormula')}</p>
            </div>

            {/* سطور الكشف: من الإيراد إلى الصافي */}
            <div className="space-y-1 rounded-2xl border border-gold-400/15 bg-black/20 p-4 text-sm">
              <Row label={t('dashboard.analytics.revenue')} value={money(data.revenue)} tip={t('finance.revenueTip')} />
              <Row label={t('finance.cogs')} value={`− ${money(data.cogs)}`} tip={t('finance.cogsTip')} muted />
              <Row label={t('finance.deliveryFees')} value={`− ${money(data.deliveryFees)}`} tip={t('finance.deliveryTip')} muted />
              <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-1.5 font-semibold text-stone-200">
                <span>{t('dashboard.analytics.profit')}</span>
                <span className="tabular-nums">{money(data.productProfit)}</span>
              </div>
              <Row label={t('finance.expensesTotal')} value={`− ${money(data.expensesTotal)}`} tip={t('finance.expensesTip')} muted />
              <div className="flex items-center justify-between gap-2 border-t-2 border-gold-400/30 pt-2">
                <span className="text-sm font-bold text-stone-200">{t('finance.netProfit')}</span>
                <span className={`font-display text-lg font-extrabold tabular-nums ${positive ? 'text-emerald-400' : 'text-red-300'}`}>{money(net)}</span>
              </div>
            </div>

            {/* صدق الأرقام: كم طلباً دخل حساب الربح وكم استُثني */}
            {(data.profitMissing > 0 || data.profitEstimated > 0) && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed font-semibold text-amber-300">
                <WarnIcon className="mt-px h-4 w-4 shrink-0" />
                <span>
                  {data.profitMissing > 0 && t('finance.missingNote', { count: data.profitMissing })}
                  {data.profitMissing > 0 && data.profitEstimated > 0 && ' · '}
                  {data.profitEstimated > 0 && t('finance.estimatedNote', { count: data.profitEstimated })}
                </span>
              </p>
            )}
          </div>

          {/* تسوية تحصيل شركات التوصيل */}
          {settle && (settle.couriers.length > 0 || settle.pending.length > 0) && (
            <div className={CARD}>
              <SectionHead icon={<TruckIcon className="h-5 w-5" />} title={t('finance.settleTitle')} desc={t('finance.settleHint')} />

              {/* المشهد بثلاثة أرقام: بالطريق · عند الشركة · قبضتِه */}
              <div className="grid grid-cols-3 gap-2">
                <Stat icon={<TruckIcon className="h-4 w-4" />} label={t('finance.inTransit')} value={money(settle.totals.transitAmount)} tip={t('finance.inTransitTip')} tone="sky" />
                <Stat icon={<ClockIcon className="h-4 w-4" />} label={t('finance.atCourier')} value={money(settle.totals.pendingAmount)} tip={t('finance.atCourierTip')} tone="amber" />
                <Stat icon={<CheckIcon className="h-4 w-4" />} label={t('finance.collected')} value={money(settle.totals.collectedAmount)} tip={t('finance.collectedTip')} tone="emerald" />
              </div>

              {/* لكل شركة على حدة — المالكة تستلم من كل شركة حوالةً مستقلّة */}
              <div className="space-y-2">
                {settle.couriers.map((c) => (
                  <div key={c.key} className="rounded-2xl border border-gold-400/15 bg-black/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-stone-100">
                        <TruckIcon className="h-4 w-4 text-stone-400" /> {t(`finance.courier.${c.key}`)}
                      </span>
                      {c.pendingOrders > 0 && (
                        <button
                          onClick={() => setConfirmCollect({ courier: c.key, count: c.pendingOrders, amount: c.pendingAmount })}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 px-2.5 py-1 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          <CheckIcon className="h-3.5 w-3.5" /> {t('finance.settleAll')}
                        </button>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                      <Mini label={t('finance.inTransit')} value={money(c.transitAmount)} count={c.transitOrders} />
                      <Mini label={t('finance.atCourier')} value={money(c.pendingAmount)} count={c.pendingOrders} strong={c.pendingOrders > 0} />
                      <Mini label={t('finance.collected')} value={money(c.collectedAmount)} count={c.collectedOrders} />
                    </div>
                  </div>
                ))}
              </div>

              {/* الطلبات المستحقّة، طلباً طلباً — للتسوية الجزئية */}
              {settle.pending.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-xs font-semibold text-stone-300">{t('finance.pendingList', { count: settle.pending.length })}</span>
                    {picked.size > 0 && (
                      <button
                        onClick={() => collect({ orderIds: [...picked] })}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        <CheckIcon className="h-3.5 w-3.5" /> {t('finance.collectPicked', { count: picked.size })}
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-gold-400/15 bg-black/20">
                    {settle.pending.map((o) => (
                      <label key={o.id} className="flex cursor-pointer items-center gap-2.5 p-3 transition hover:bg-white/5">
                        <input
                          type="checkbox" checked={picked.has(o.id)} onChange={() => togglePick(o.id)}
                          className="h-4 w-4 shrink-0 accent-emerald-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-stone-100">{o.customerName || t('finance.noName')}</p>
                          <p className="mt-0.5 truncate text-[11px] text-stone-400">
                            {o.reference || '—'} · {t(`finance.courier.${o.courier}`)} · {new Date(o.createdAt).toLocaleDateString(i18n.language)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-gold-300">{money(o.total)}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* إضافة مصروف */}
          <form onSubmit={addExpense} className={CARD}>
            <SectionHead icon={<PlusIcon className="h-5 w-5" />} title={t('finance.addTitle')} desc={t('finance.addHint')} />
            <div className="grid gap-4 sm:grid-cols-2 [&>div]:min-w-0">
              <Field label={t('finance.category')} tip={t('finance.categoryTip')}>
                <Select
                  value={form.category}
                  onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  options={CATEGORIES.map((c) => ({ value: c.key, label: t(`finance.cat.${c.key}`) }))}
                />
              </Field>
              <Field label={t('finance.amount')} tip={t('finance.amountTip')} required>
                <div className="relative">
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal" required placeholder="0"
                    className="input pe-8" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                  <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">{cur}</span>
                </div>
              </Field>
              <Field label={t('finance.spentAt')} tip={t('finance.spentAtTip')}>
                <input type="date" className="input" value={form.spentAt} onChange={(e) => setForm({ ...form, spentAt: e.target.value })} />
              </Field>
              <Field label={t('finance.note')} max={200} value={form.note}>
                <input type="text" maxLength={200} className="input" placeholder={t('finance.notePlaceholder')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </Field>
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full gap-2">
              <PlusIcon className="h-4 w-4" /> {busy ? t('common.loading') : t('finance.add')}
            </button>
          </form>

          {/* مصاريف الشهر */}
          <div className={CARD}>
            <SectionHead
              icon={<CashIcon className="h-5 w-5" />}
              title={t('finance.expensesTitle')}
              desc={data.expenses.length ? t('finance.expensesCount', { count: data.expenses.length }) : t('finance.expensesHint')}
            />

            {data.expenses.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gold-400/25 bg-black/15 p-8 text-center">
                <CashIcon className="h-8 w-8 text-gold-300" />
                <span className="text-sm text-stone-400">{t('finance.noExpenses')}</span>
              </div>
            ) : (
              <>
                {/* توزيع المصاريف: أين يذهب مالك فعلاً */}
                <div className="space-y-2">
                  {CATEGORIES.filter((c) => data.expensesByCategory[c.key]).map((c) => {
                    const amount = data.expensesByCategory[c.key];
                    const pct = data.expensesTotal > 0 ? Math.round((amount / data.expensesTotal) * 100) : 0;
                    return (
                      <div key={c.key} className="rounded-2xl border border-gold-400/15 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-1.5 font-semibold text-stone-200"><c.Icon className="h-4 w-4 text-stone-400" /> {t(`finance.cat.${c.key}`)}</span>
                          <span className="tabular-nums text-stone-300">{money(amount)} <span className="opacity-70">· {pct}%</span></span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gold-400/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#e6c878] to-[#b8932c]" style={{ width: `${Math.max(pct, 3)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* السجلّ المفصّل */}
                <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-gold-400/15 bg-black/20">
                  {data.expenses.map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-100">{t(`finance.cat.${e.category}`)}</p>
                        <p className="mt-0.5 truncate text-[11px] text-stone-400">
                          {new Date(e.spentAt).toLocaleDateString(i18n.language)}{e.note ? ` · ${e.note}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-stone-200">{money(e.amount)}</span>
                      <button
                        onClick={() => setConfirmDel(e)}
                        title={t('common.delete')} aria-label={t('common.delete')}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-red-500/10 hover:text-red-300"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {data.profitMissing > 0 && (
            <p className="text-center text-[11px] text-stone-400">
              <Link to="/dashboard?tab=myProducts" className="text-gold-300 underline-offset-2 hover:underline">{t('finance.fixCosts')}</Link>
            </p>
          )}
        </>
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

// سطر بكشف الشهر
function Row({ label, value, tip, muted }) {
  return (
    <div className={`flex items-center justify-between gap-2 ${muted ? 'text-stone-400' : 'text-stone-300'}`}>
      <span className="flex items-center gap-1.5">{label} <Tip text={tip} /></span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// بطاقة رقم بلون دلالي — بالطريق (سماوي) · عند الشركة (كهرماني) · قبضتِه (أخضر)
function Stat({ icon, label, value, tip, tone }) {
  const tones = {
    sky: 'border-sky-400/30 bg-sky-500/10 text-sky-400',
    amber: 'border-amber-400/30 bg-amber-500/10 text-amber-400',
    emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-400',
  };
  return (
    <div className={`rounded-2xl border p-2.5 text-center ${tones[tone]}`}>
      <p className="flex items-center justify-center gap-1 text-[10px] font-semibold text-stone-400">
        {label} <Tip text={tip} />
      </p>
      <p className="mt-1 flex items-center justify-center gap-1 font-display text-base font-extrabold tabular-nums sm:text-lg">
        {icon}<span className="truncate">{value}</span>
      </p>
    </div>
  );
}

// سطر مصغّر داخل بطاقة الشركة
function Mini({ label, value, count, strong }) {
  return (
    <div>
      <p className="text-stone-400">{label}</p>
      <p className={`mt-0.5 tabular-nums ${strong ? 'font-bold text-amber-400' : 'text-stone-200'}`}>{value}</p>
      <p className="text-stone-400">{count}</p>
    </div>
  );
}
