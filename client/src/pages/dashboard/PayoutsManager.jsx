import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { PageHead } from '../../components/FormField.jsx';
import { CashIcon, CheckIcon, ClockIcon, BoltIcon } from '../../components/icons.jsx';

const STATUS_STYLE = {
  none:    'border-stone-300 bg-stone-100 text-stone-600 dark:border-stone-600 dark:bg-ink-900/60 dark:text-stone-300',
  pending: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  active:  'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
};
const STATUS_ICON = { none: '📝', pending: '⏳', active: '✅' };

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
    <div className="dash-section space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold">{s.name}</h3>
          <p className="text-xs text-stone-400">{s.email}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[st]}`}>
          {STATUS_ICON[st]} {st === 'active' ? 'مفعّل' : st === 'pending' ? 'بانتظار التفعيل' : 'لم يُفعَّل'}
        </span>
      </div>

      <div className="grid gap-1.5 text-sm" dir="ltr">
        <p><span className="text-stone-400">Bank:</span> {s.bankName || '—'}</p>
        <p><span className="text-stone-400">IBAN:</span> {s.bankIban || '—'}</p>
        <p><span className="text-stone-400">SWIFT:</span> {s.bankSwift || '—'}</p>
        <p><span className="text-stone-400">Account:</span> {s.bankAccountName || '—'}</p>
        {s.subaccount && <p><span className="text-stone-400">Sub-account:</span> <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{s.subaccount}</span></p>}
      </div>

      {st !== 'active' && s.bankIban && (
        <div className="space-y-2 border-t border-gold-400/15 pt-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-stone-500">عمولة المنصّة %</label>
            <input type="number" min="0" max="100" className="input w-20 text-center text-sm" value={fee} onChange={(e) => setFee(e.target.value)} dir="ltr" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={autoCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-wine px-4 py-2 text-sm font-bold text-cream transition hover:brightness-110 disabled:opacity-50"
            >
              <BoltIcon className="h-4 w-4" /> {busy ? 'جاري الإنشاء…' : 'إنشاء تلقائي عند Lahza'}
            </button>
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="rounded-xl border border-gold-400/30 px-3 py-2 text-sm font-semibold transition hover:bg-gold-400/10"
            >
              إدخال يدوي
            </button>
          </div>
          {showManual && (
            <div className="flex items-center gap-2">
              <input
                type="text" dir="ltr" placeholder="ACCT_xxxxxxx"
                className="input flex-1 font-mono text-sm"
                value={manualCode} onChange={(e) => setManualCode(e.target.value)}
              />
              <button type="button" disabled={busy} onClick={manualSave} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                <CheckIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {err && <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600">{err}</p>}
      {msg && <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{msg}</p>}
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

  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;
  if (!list) return <Spinner />;

  const pending = list.filter((s) => s.status !== 'active' && s.bankIban);
  const active = list.filter((s) => s.status === 'active');
  const noBank = list.filter((s) => !s.bankIban);

  return (
    <div className="space-y-5">
      <PageHead icon={<CashIcon className="h-5 w-5" />} title="إدارة المدفوعات" desc="المتاجر التي أدخلت بياناتها البنكية — فعّل حسابها الفرعي ليظهر زرّ الفيزا" />

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold"><ClockIcon className="h-4 w-4 text-amber-500" /> بانتظار التفعيل ({pending.length})</h2>
          {pending.map((s) => <Row key={s.id} s={s} onUpdate={load} />)}
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold"><CheckIcon className="h-4 w-4 text-emerald-500" /> مفعّلة ({active.length})</h2>
          {active.map((s) => <Row key={s.id} s={s} onUpdate={load} />)}
        </div>
      )}

      {noBank.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-stone-400 transition hover:text-stone-600">
            لم تُدخل بيانات بنكية ({noBank.length})
          </summary>
          <div className="mt-2 space-y-2">
            {noBank.map((s) => (
              <div key={s.id} className="dash-section flex items-center justify-between rounded-xl px-4 py-2.5 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-stone-400">{s.email}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {list.length === 0 && <p className="py-8 text-center text-stone-400">لا توجد متاجر بعد</p>}
    </div>
  );
}
