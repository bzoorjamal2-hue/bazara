import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { PageHead, SectionHead, Tip } from '../../components/FormField.jsx';
import { CashIcon, CheckIcon, ClockIcon, BoltIcon, CardIcon } from '../../components/icons.jsx';

function StatusBadge({ status }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-cream" style={{ background: '#047857' }}>
        <CheckIcon className="h-3 w-3" /> مفعّل
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: '#92400e', color: '#fef3c7' }}>
      <ClockIcon className="h-3 w-3" /> بانتظار التفعيل
    </span>
  );
}

function Row({ s, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [fee, setFee] = useState('0');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const autoCreate = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const { data } = await api.post(`/subscription/payouts/${s.id}/auto-create`, { feePercent: Number(fee) || 0 });
      setMsg(`تم: ${data.subaccount}`);
      onUpdate?.();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const manualSave = async () => {
    if (!manualCode.trim()) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await api.post(`/subscription/payouts/${s.id}/entity`, {
        subaccount: manualCode.trim(),
        feePercent: Number(fee) || 0,
      });
      setMsg('تم الحفظ');
      setShowManual(false);
      onUpdate?.();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const st = s.status || 'none';

  return (
    <div className="glass p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-100">{s.name}</span>
            <StatusBadge status={st} />
          </div>
          <p className="mt-1 text-xs text-stone-400" dir="ltr">{s.email}</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-gold-400/15 bg-black/20 p-3.5">
        <div className="grid gap-1.5 text-sm" dir="ltr">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold text-stone-500">Bank</span>
            <span className="text-stone-200">{s.bankName || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold text-stone-500">IBAN</span>
            <span className="font-mono text-xs text-stone-200">{s.bankIban || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold text-stone-500">SWIFT</span>
            <span className="font-mono text-xs text-stone-200">{s.bankSwift || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold text-stone-500">Account</span>
            <span className="text-stone-200">{s.bankAccountName || '—'}</span>
          </div>
          {s.subaccount && (
            <div className="flex items-center gap-2 border-t border-gold-400/10 pt-1.5">
              <span className="w-20 shrink-0 text-xs font-semibold text-stone-500">Sub-acct</span>
              <span className="font-mono text-xs font-bold text-emerald-400">{s.subaccount}</span>
            </div>
          )}
        </div>
      </div>

      {st !== 'active' && s.bankIban && (
        <div className="mt-3 flex w-full flex-wrap items-center gap-1.5 border-t border-gold-400/10 pt-3 sm:gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-stone-400">عمولة %</label>
            <input
              type="number" min="0" max="100" dir="ltr"
              className="input w-16 text-center text-sm !py-1"
              value={fee} onChange={(e) => setFee(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={autoCreate}
            className="btn-primary inline-flex items-center gap-1.5 !py-1.5 text-xs"
          >
            <BoltIcon className="h-3.5 w-3.5" /> {busy ? 'جاري…' : 'إنشاء عند Lahza'}
          </button>
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-gold-400/30 px-2.5 py-1 text-xs font-bold text-gold-200 transition hover:bg-gold-400/10"
          >
            <CardIcon className="h-3.5 w-3.5" /> إدخال يدوي
          </button>
        </div>
      )}

      {showManual && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text" dir="ltr" placeholder="ACCT_xxxxxxx"
            className="input flex-1 font-mono text-sm"
            value={manualCode} onChange={(e) => setManualCode(e.target.value)}
          />
          <button
            type="button" disabled={busy} onClick={manualSave}
            className="btn-primary !py-2 text-xs"
          >
            <CheckIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {err && <p className="mt-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">{err}</p>}
      {msg && <p className="mt-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400">{msg}</p>}
    </div>
  );
}

export default function PayoutsManager() {
  const { t } = useTranslation();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    api.get('/subscription/payouts')
      .then((r) => setList(r.data.payouts))
      .catch((e) => setError(getErrorMessage(e)));
  };

  useEffect(() => { load(); }, []);

  if (error) return <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>;
  if (!list) return <Spinner />;

  const pending = list.filter((s) => s.status !== 'active' && s.bankIban);
  const active = list.filter((s) => s.status === 'active');
  const noBank = list.filter((s) => !s.bankIban);

  return (
    <div className="space-y-5">
      <PageHead icon={<CashIcon className="h-6 w-6" />} title={t('admin.payouts.title')} hint={t('admin.payouts.hint')} />

      {pending.length > 0 && (
        <div className="space-y-3">
          <SectionHead icon={<ClockIcon className="h-5 w-5" />} title={t('admin.payouts.pending', { count: pending.length })} desc={t('admin.payouts.pendingDesc')} />
          {pending.map((s) => <Row key={s.id} s={s} onUpdate={load} />)}
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <SectionHead icon={<CheckIcon className="h-5 w-5" />} title={t('admin.payouts.active', { count: active.length })} desc={t('admin.payouts.activeDesc')} />
          {active.map((s) => <Row key={s.id} s={s} onUpdate={load} />)}
        </div>
      )}

      {noBank.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-stone-400 transition hover:text-stone-200">
            <CardIcon className="h-4 w-4" /> {t('admin.payouts.noBank', { count: noBank.length })}
          </summary>
          <div className="mt-3 space-y-2">
            {noBank.map((s) => (
              <div key={s.id} className="glass flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium text-stone-200">{s.name}</span>
                <span className="text-xs text-stone-400">{s.email}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {list.length === 0 && (
        <div className="glass p-10 text-center text-stone-400">{t('admin.payouts.empty')}</div>
      )}
    </div>
  );
}
