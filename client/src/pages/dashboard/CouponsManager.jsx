import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { TicketIcon, EditIcon, TrashIcon } from '../../components/icons.jsx';

const EMPTY = { code: '', type: 'percent', value: '', minTotal: '', maxUses: '', expiresAt: '', active: true };

export default function CouponsManager() {
  const { t } = useTranslation();
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/coupons').then((r) => setCoupons(r.data.coupons)).catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const reset = () => { setForm(EMPTY); setEditId(null); setError(''); };

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const remove = async (c) => {
    if (!window.confirm(t('dashboard.coupons.deleteConfirm'))) return;
    setCoupons((prev) => prev.filter((x) => x.id !== c.id));
    try { await api.delete(`/coupons/${c.id}`); } catch (e) { setError(getErrorMessage(e)); load(); }
  };

  if (coupons === null && !error) return <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold gradient-text"><TicketIcon className="h-6 w-6" /> {t('dashboard.coupons.title')}</h1>
        <p className="mt-1 text-sm text-stone-400">{t('dashboard.coupons.hint')}</p>
      </div>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {/* نموذج إضافة/تعديل كوبون */}
      <form onSubmit={submit} className="glass space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-gold-200">{editId ? t('dashboard.coupons.editTitle') : t('dashboard.coupons.newTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 [&>div]:min-w-0">
          <div>
            <label className="label">{t('dashboard.coupons.code')}</label>
            <input className="input uppercase" required placeholder="SUMMER25" value={form.code} onChange={set('code')} />
          </div>
          <div>
            <label className="label">{t('dashboard.coupons.type')}</label>
            <Select
              value={form.type}
              onChange={(v) => setForm((f) => ({ ...f, type: v }))}
              options={[
                { value: 'percent', label: t('dashboard.coupons.percent') },
                { value: 'fixed', label: t('dashboard.coupons.fixed') },
              ]}
            />
          </div>
          <div>
            <label className="label">{form.type === 'percent' ? t('dashboard.coupons.valuePercent') : t('dashboard.coupons.valueFixed')}</label>
            <input className="input" type="number" min="0" step="0.01" required value={form.value} onChange={set('value')} />
          </div>
          <div>
            <label className="label">{t('dashboard.coupons.minTotal')} <span className="text-stone-500">({t('common.optional')})</span></label>
            <input className="input" type="number" min="0" step="0.01" placeholder="0" value={form.minTotal} onChange={set('minTotal')} />
          </div>
          <div>
            <label className="label">{t('dashboard.coupons.maxUses')} <span className="text-stone-500">({t('common.optional')})</span></label>
            <input className="input" type="number" min="1" placeholder="∞" value={form.maxUses} onChange={set('maxUses')} />
          </div>
          <div>
            <label className="label">{t('dashboard.coupons.expiresAt')} <span className="text-stone-500">({t('common.optional')})</span></label>
            <input className="input w-full max-w-full [color-scheme:dark]" type="date" value={form.expiresAt} onChange={set('expiresAt')} />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gold-400/15 bg-black/20 px-4 py-2.5">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-5 w-5 accent-gold-400" />
          <span className="text-sm text-stone-200">{t('dashboard.coupons.active')}</span>
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? t('common.loading') : (editId ? t('common.save') : t('dashboard.coupons.add'))}</button>
          {editId && <button type="button" onClick={reset} className="btn-ghost">{t('common.cancel')}</button>}
        </div>
      </form>

      {/* قائمة الكوبونات */}
      {coupons && coupons.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('dashboard.coupons.empty')}</div>
      ) : (
        <div className="space-y-3">
          {coupons?.map((c) => {
            const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
            const maxed = c.maxUses != null && c.usedCount >= c.maxUses;
            const off = !c.active || expired || maxed;
            return (
              <div key={c.id} className={`glass p-4 ${off ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-gold-400/15 px-3 py-1 font-mono text-lg font-bold tracking-wider text-gold-200" dir="ltr">{c.code}</span>
                    <span className="font-bold text-stone-100">
                      {c.type === 'percent' ? `${c.value}%` : `${t('common.currency')}${c.value}`} {t('dashboard.coupons.discount')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggle(c)} className={`rounded-full px-3 py-1 text-xs font-bold ${c.active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-stone-500/20 text-stone-300'}`}>
                      {c.active ? t('dashboard.coupons.statusActive') : t('dashboard.coupons.statusOff')}
                    </button>
                    <button onClick={() => edit(c)} className="rounded-lg p-2 text-stone-400 hover:text-gold-200" aria-label="edit"><EditIcon className="h-4 w-4" /></button>
                    <button onClick={() => remove(c)} className="rounded-lg p-2 text-stone-400 hover:text-red-300" aria-label="delete"><TrashIcon className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">
                  {c.minTotal > 0 && <span>{t('dashboard.coupons.minTotal')}: {t('common.currency')}{c.minTotal}</span>}
                  <span>{t('dashboard.coupons.used')}: {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}</span>
                  {c.expiresAt && <span className={expired ? 'text-red-300' : ''}>{t('dashboard.coupons.expiresAt')}: {new Date(c.expiresAt).toLocaleDateString()}</span>}
                  {expired && <span className="text-red-300">• {t('dashboard.coupons.expired')}</span>}
                  {maxed && <span className="text-red-300">• {t('dashboard.coupons.maxed')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
