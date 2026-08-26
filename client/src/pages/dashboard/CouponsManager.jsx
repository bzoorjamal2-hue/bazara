import { useEffect, useState } from 'react';
import useSessionState from '../../hooks/useSessionState.js';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { TicketIcon, EditIcon, TrashIcon, CopyIcon, CheckIcon, PlusIcon, CashIcon, ClockIcon, UsersIcon, XIcon, SearchIcon, ShareIcon } from '../../components/icons.jsx';
import { PageHead, SectionHead, Field, DateInput } from '../../components/FormField.jsx';

const EMPTY = { code: '', type: 'percent', value: '', minTotal: '', maxUses: '', expiresAt: '', active: true };

export default function CouponsManager() {
  const { t } = useTranslation();
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  // ما كُتب بنموذج الكوبون والكوبون قيد التحرير يبقيان بالخروج والعودة
  const [form, setForm] = useSessionState('coupons:form', EMPTY);
  const [editId, setEditId] = useSessionState('coupons:editId', null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [copied, setCopied] = useState('');
  const [q, setQ] = useSessionState('coupons:q', ''); // بحث بالكود
  const [stateFilter, setStateFilter] = useSessionState('coupons:state', 'all'); // all | on | off

  const load = () => api.get('/coupons').then((r) => setCoupons(r.data.coupons)).catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const reset = () => { setForm(EMPTY); setEditId(null); setError(''); };
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 1800); };

  const edit = (c) => {
    setEditId(c.id);
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      minTotal: c.minTotal ? String(c.minTotal) : '',
      maxUses: c.maxUses != null ? String(c.maxUses) : '',
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : '',
      active: c.active,
    });
    document.getElementById('coupon-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    const payload = {
      code: form.code, type: form.type,
      value: parseFloat(form.value) || 0,
      minTotal: form.minTotal === '' ? 0 : parseFloat(form.minTotal),
      maxUses: form.maxUses === '' ? null : parseInt(form.maxUses, 10),
      expiresAt: form.expiresAt || null,
      active: form.active,
    };
    try {
      if (editId) await api.put(`/coupons/${editId}`, payload);
      else await api.post('/coupons', payload);
      flash(t(editId ? 'dashboard.coupons.saved' : 'dashboard.coupons.created'));
      reset();
      load();
    } catch (e2) {
      setError(getErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c) => {
    setCoupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    try {
      await api.put(`/coupons/${c.id}`, {
        code: c.code, type: c.type, value: c.value, minTotal: c.minTotal,
        maxUses: c.maxUses, expiresAt: c.expiresAt, active: !c.active,
      });
    } catch (e) { setError(getErrorMessage(e)); load(); }
  };

  const doRemove = async () => {
    const c = confirmDel;
    if (!c) return;
    setConfirmDel(null);
    setCoupons((prev) => prev.filter((x) => x.id !== c.id));
    try { await api.delete(`/coupons/${c.id}`); } catch (e) { setError(getErrorMessage(e)); load(); }
  };

  const copyCode = async (c) => {
    try { await navigator.clipboard.writeText(c.code); setCopied(c.id); setTimeout(() => setCopied(''), 1600); } catch { /* تجاهُل */ }
  };

  // نسخ كوبون: نفتح النموذج مُعبّأً بنفس الشروط وكود جديد — لعمل كوبون مشابه بسرعة
  const duplicate = (c) => {
    setEditId(null);
    setForm({
      code: `${c.code}-2`.slice(0, 20),
      type: c.type,
      value: String(c.value),
      minTotal: c.minTotal ? String(c.minTotal) : '',
      maxUses: c.maxUses != null ? String(c.maxUses) : '',
      expiresAt: '',
      active: true,
    });
    document.getElementById('coupon-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // نصّ جاهز لمشاركة الكوبون مع الزبائن (واتساب/إنستغرام) بشروطه كاملة
  const shareCoupon = async (c) => {
    const terms = [
      c.minTotal > 0 ? t('dashboard.coupons.shareMin', { amount: `${t('common.currency')}${c.minTotal}` }) : '',
      c.expiresAt ? t('dashboard.coupons.shareUntil', { date: new Date(c.expiresAt).toLocaleDateString() }) : '',
    ].filter(Boolean).join(' · ');
    const text = [
      t('dashboard.coupons.shareText', {
        code: c.code,
        value: c.type === 'percent' ? `${c.value}%` : `${t('common.currency')}${c.value}`,
      }),
      terms,
    ].filter(Boolean).join('\n');
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); flash(t('common.copied')); }
    } catch { /* أُلغيت المشاركة */ }
  };

  if (coupons === null && !error) return <Spinner />;

  const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';
  const list = coupons || [];
  // حالة الكوبون الفعلية: موقوف يدوياً · منتهي التاريخ · نفدت استخداماته · فعّال
  const stateOf = (c) => {
    if (!c.active) return { key: 'off', label: t('dashboard.coupons.statusOff'), cls: 'bg-stone-500/20 text-stone-300' };
    if (c.expiresAt && new Date(c.expiresAt) < new Date()) return { key: 'expired', label: t('dashboard.coupons.expired'), cls: 'bg-red-500/15 text-red-300' };
    if (c.maxUses != null && c.usedCount >= c.maxUses) return { key: 'maxed', label: t('dashboard.coupons.maxed'), cls: 'bg-red-500/15 text-red-300' };
    return { key: 'on', label: t('dashboard.coupons.statusActive'), cls: 'bg-emerald-500/15 text-emerald-400' };
  };

  // لمحة سريعة + تصفية: «موقوف» هنا تعني كل ما لا يعمل الآن (موقوف/منتهي/مستهلك)
  const stats = {
    active: list.filter((c) => stateOf(c).key === 'on').length,
    off: list.filter((c) => stateOf(c).key !== 'on').length,
    uses: list.reduce((s, c) => s + (Number(c.usedCount) || 0), 0),
  };
  const shown = list.filter((c) => {
    if (stateFilter === 'on' && stateOf(c).key !== 'on') return false;
    if (stateFilter === 'off' && stateOf(c).key === 'on') return false;
    return !q.trim() || c.code.includes(q.trim());
  });

  return (
    <div className="space-y-5">
      <PageHead icon={<TicketIcon className="h-6 w-6" />} title={t('dashboard.coupons.title')} hint={t('dashboard.coupons.hint')} />

      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
          <CheckIcon className="h-4 w-4 shrink-0" /> {msg}
        </div>
      )}
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}

      {/* نموذج إضافة/تعديل كوبون */}
      <form id="coupon-form" onSubmit={submit} className={`${CARD} scroll-mt-[calc(env(safe-area-inset-top,0px)+5rem)]`}>
        <SectionHead
          icon={editId ? <EditIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
          title={editId ? t('dashboard.coupons.editTitle') : t('dashboard.coupons.newTitle')}
          desc={t('dashboard.coupons.formHint')}
        />

        <div className="grid gap-4 sm:grid-cols-2 [&>div]:min-w-0">
          <Field label={t('dashboard.coupons.code')} tip={t('dashboard.coupons.codeTip')} max={20} value={form.code} required>
            <input
              className="input font-mono tracking-wider" required maxLength={20} placeholder="SUMMER25" dir="ltr"
              value={form.code}
              // نُخزّن الكود بحروف كبيرة بلا مسافات — الزبونة تكتبه بأي صيغة فيتطابق
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
            />
          </Field>

          <Field label={t('dashboard.coupons.type')} tip={t('dashboard.coupons.typeTip')}>
            <Select
              value={form.type}
              onChange={(v) => setForm((f) => ({ ...f, type: v }))}
              options={[
                { value: 'percent', label: t('dashboard.coupons.percent') },
                { value: 'fixed', label: t('dashboard.coupons.fixed') },
              ]}
            />
          </Field>

          <Field
            label={form.type === 'percent' ? t('dashboard.coupons.valuePercent') : t('dashboard.coupons.valueFixed')}
            tip={t('dashboard.coupons.valueTip')} required
          >
            <div className="relative">
              <input className="input pe-8" type="number" min="0" step="0.01" required inputMode="decimal" value={form.value} onChange={set('value')} />
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">
                {form.type === 'percent' ? '%' : t('common.currency')}
              </span>
            </div>
          </Field>

          <Field label={t('dashboard.coupons.minTotal')} icon={<CashIcon className="h-4 w-4" />} tip={t('dashboard.coupons.minTotalTip')} optional>
            <div className="relative">
              <input className="input pe-8" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={form.minTotal} onChange={set('minTotal')} />
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-stone-400">{t('common.currency')}</span>
            </div>
          </Field>

          <Field label={t('dashboard.coupons.maxUses')} icon={<UsersIcon className="h-4 w-4" />} tip={t('dashboard.coupons.maxUsesTip')} optional>
            <input className="input" type="number" min="1" inputMode="numeric" placeholder="∞" value={form.maxUses} onChange={set('maxUses')} />
          </Field>

          <Field label={t('dashboard.coupons.expiresAt')} icon={<ClockIcon className="h-4 w-4" />} tip={t('dashboard.coupons.expiresTip')} optional>
            <DateInput
              value={form.expiresAt}
              onChange={(v) => setForm({ ...form, expiresAt: v })}
              clearLabel={t('dashboard.coupons.clearDate')}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gold-400/15 bg-black/20 px-4 py-2.5">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-5 w-5 accent-gold-400" />
          <span className="min-w-0 flex-1 text-sm text-stone-200">{t('dashboard.coupons.active')}</span>
          <span className="text-[11px] text-stone-400">{t('dashboard.coupons.activeHint')}</span>
        </label>

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? t('common.loading') : (editId ? t('common.save') : t('dashboard.coupons.add'))}</button>
          {editId && <button type="button" onClick={reset} className="btn-ghost">{t('common.cancel')}</button>}
        </div>
      </form>

      {/* قائمة الكوبونات */}
      <div className={CARD}>
        <SectionHead
          icon={<TicketIcon className="h-5 w-5" />}
          title={t('dashboard.coupons.listTitle')}
          desc={list.length ? t('dashboard.coupons.listCount', { count: list.length }) : t('dashboard.coupons.listHint')}
        />

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gold-400/25 bg-black/15 p-8 text-center">
            <TicketIcon className="h-8 w-8 text-gold-300" />
            <span className="text-sm text-stone-400">{t('dashboard.coupons.empty')}</span>
          </div>
        ) : (
          <>
            {/* لمحة سريعة: كم كوبوناً يعمل الآن وكم مرّة استُخدمت كوبوناتك */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t('dashboard.coupons.statsActive'), value: stats.active, cls: 'text-emerald-400' },
                { label: t('dashboard.coupons.statsUses'), value: stats.uses, cls: 'text-gold-300' },
                { label: t('dashboard.coupons.statsOff'), value: stats.off, cls: 'text-stone-300' },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-gold-400/15 bg-black/20 p-3 text-center">
                  <p className={`font-display text-2xl font-extrabold tabular-nums ${s.cls}`}>{s.value}</p>
                  <p className="mt-0.5 text-[11px] text-stone-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* بحث + تصفية بالحالة — تظهر عند تعدّد الكوبونات */}
            {list.length > 3 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 rounded-xl border border-gold-400/15 bg-black/20 px-3 focus-within:border-gold-400/60 focus-within:ring-2 focus-within:ring-gold-400/25">
                  <SearchIcon className="h-4 w-4 shrink-0 text-stone-400" />
                  <input
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none"
                    placeholder={t('dashboard.coupons.searchPlaceholder')}
                    value={q}
                    onChange={(e) => setQ(e.target.value.toUpperCase())}
                    dir="ltr"
                  />
                  {q && (
                    <button type="button" onClick={() => setQ('')} aria-label={t('common.cancel')} className="shrink-0 text-stone-400 transition hover:text-gold-200">
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[['all', t('common.all'), list.length], ['on', t('dashboard.coupons.statusActive'), stats.active], ['off', t('dashboard.coupons.statsOff'), stats.off]].map(([k, label, n]) => (
                    <button
                      key={k} type="button" onClick={() => setStateFilter(k)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        stateFilter === k ? 'border-[#b09a7e] bg-[#b09a7e] text-[#3f2e22]' : 'border-gold-400/25 bg-gold-400/5 text-stone-300 hover:bg-gold-400/15 hover:text-gold-200'
                      }`}
                    >
                      {label} <span className={`rounded-full px-1.5 text-[10px] ${stateFilter === k ? 'bg-[#3f2e22]/15' : 'bg-gold-400/10'}`}>{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {shown.length === 0 ? (
              <p className="rounded-2xl border border-gold-400/15 bg-black/20 py-8 text-center text-sm text-stone-400">{t('dashboard.coupons.noMatch')}</p>
            ) : (
          <div className="space-y-2.5">
            {shown.map((c) => {
              const st = stateOf(c);
              const off = st.key !== 'on';
              const pct = c.maxUses ? Math.min(100, Math.round((c.usedCount / c.maxUses) * 100)) : 0;
              return (
                <div key={c.id} className={`rounded-2xl border border-gold-400/15 bg-black/20 p-3 transition ${off ? 'opacity-70' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {/* الكود يُنسخ بضغطة — تشاركه المالكة بالإنستغرام أو الواتساب */}
                      <button
                        type="button" onClick={() => copyCode(c)}
                        title={t('common.copyLink')} aria-label={t('common.copyLink')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gold-400/15 px-2.5 py-1 font-mono text-base font-bold tracking-wider text-gold-200 transition hover:bg-gold-400/25"
                        dir="ltr"
                      >
                        {c.code}
                        {copied === c.id ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5 opacity-60" />}
                      </button>
                      <span className="text-sm font-bold text-stone-100">
                        {c.type === 'percent' ? `${c.value}%` : `${t('common.currency')}${c.value}`} {t('dashboard.coupons.discount')}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => toggle(c)}
                        title={t(c.active ? 'dashboard.coupons.turnOff' : 'dashboard.coupons.turnOn')}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition hover:brightness-110 ${st.cls}`}
                      >
                        {st.label}
                      </button>
                      <button onClick={() => shareCoupon(c)} title={t('dashboard.coupons.shareCoupon')} aria-label={t('dashboard.coupons.shareCoupon')} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-gold-400/10 hover:text-gold-200"><ShareIcon className="h-4 w-4" /></button>
                      <button onClick={() => duplicate(c)} title={t('dashboard.store.duplicate')} aria-label={t('dashboard.store.duplicate')} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-gold-400/10 hover:text-gold-200"><CopyIcon className="h-4 w-4" /></button>
                      <button onClick={() => edit(c)} title={t('common.edit')} aria-label={t('common.edit')} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-gold-400/10 hover:text-gold-200"><EditIcon className="h-4 w-4" /></button>
                      <button onClick={() => setConfirmDel(c)} title={t('common.delete')} aria-label={t('common.delete')} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition hover:bg-red-500/10 hover:text-red-300"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-400">
                    {c.minTotal > 0 && <span>{t('dashboard.coupons.minTotal')}: <span className="text-stone-300">{t('common.currency')}{c.minTotal}</span></span>}
                    <span>{t('dashboard.coupons.used')}: <span className="text-stone-300">{c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}</span></span>
                    {c.expiresAt && (
                      <span className={st.key === 'expired' ? 'text-red-300' : ''}>
                        {t('dashboard.coupons.expiresAt')}: <span className={st.key === 'expired' ? '' : 'text-stone-300'}>{new Date(c.expiresAt).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>

                  {/* شريط الاستخدام — يبيّن كم بقي من الكوبون بلمحة */}
                  {c.maxUses != null && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gold-400/10">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-400' : 'bg-gradient-to-r from-[#cdbda4] to-[#8a7657]'}`}
                        style={{ width: `${Math.max(pct, c.usedCount > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDel}
        title={t('dashboard.coupons.deleteTitle')}
        message={confirmDel ? `${t('dashboard.coupons.deleteConfirm')}\n«${confirmDel.code}»` : ''}
        confirmLabel={t('common.delete')}
        onConfirm={doRemove}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
