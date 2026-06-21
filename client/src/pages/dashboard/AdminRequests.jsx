import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';

function genPassword() {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const dig = '23456789';
  const sym = '!@#$%&*';
  const all = lower + upper + dig + sym;
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let p = pick(lower) + pick(upper) + pick(dig) + pick(sym);
  for (let i = 0; i < 6; i++) p += pick(all);
  return p.split('').sort(() => Math.random() - 0.5).join('');
}

export default function AdminRequests() {
  const { t } = useTranslation();
  const [error, setError] = useState('');

  // إعادة تعيين كلمة مرور مشترك
  const [rf, setRf] = useState({ email: '', newPassword: '' });
  const [rMsg, setRMsg] = useState('');
  const [rErr, setRErr] = useState('');
  const [rBusy, setRBusy] = useState(false);

  // تعليمات الدفع
  const [payInfo, setPayInfo] = useState('');
  const [payMsg, setPayMsg] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  // أكواد التفعيل
  const [codes, setCodes] = useState(null);
  const [genPlan, setGenPlan] = useState('monthly');
  const [genCount, setGenCount] = useState(1);
  const [newCodes, setNewCodes] = useState([]);
  const [codeBusy, setCodeBusy] = useState(false);

  const loadCodes = useCallback(() => {
    api.get('/subscription/codes').then((r) => setCodes(r.data.codes)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  useEffect(() => {
    api.get('/subscription/settings').then((r) => setPayInfo(r.data.paymentInfo || '')).catch(() => {});
    loadCodes();
  }, [loadCodes]);

  const doReset = async (e) => {
    e.preventDefault();
    setRMsg(''); setRErr(''); setRBusy(true);
    try {
      await api.post('/auth/admin/reset-password', rf);
      setRMsg(`${t('admin.resetDone')} (${rf.email} → ${rf.newPassword})`);
    } catch (err) {
      setRErr(getErrorMessage(err, t('errors.generic')));
    } finally {
      setRBusy(false);
    }
  };

  const savePayment = async (e) => {
    e.preventDefault();
    setPayMsg(''); setPayBusy(true);
    try {
      await api.put('/subscription/settings', { paymentInfo: payInfo });
      setPayMsg(t('admin.paymentSaved'));
      setTimeout(() => setPayMsg(''), 2000);
    } catch (err) {
      setPayMsg(getErrorMessage(err, t('errors.generic')));
    } finally {
      setPayBusy(false);
    }
  };

  const generate = async (e) => {
    e.preventDefault();
    setError(''); setCodeBusy(true);
    try {
      const { data } = await api.post('/subscription/codes', { plan: genPlan, count: genCount });
      setNewCodes(data.codes);
      loadCodes();
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setCodeBusy(false);
    }
  };

  const Alert = ({ ok, children }) =>
    children ? (
      <div className={`rounded-xl border px-4 py-2.5 text-sm ${ok ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-red-400/30 bg-red-500/10 text-red-200'}`}>{children}</div>
    ) : null;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold gradient-text">{t('admin.title')}</h1>
      <Alert>{error}</Alert>

      {/* أكواد التفعيل */}
      <div className="glass space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-stone-100">🔑 {t('admin.codesTitle')}</h2>
        <p className="text-xs text-stone-400">{t('admin.codesHint')}</p>
        <form onSubmit={generate} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">{t('admin.plan')}</label>
            <Select
              value={genPlan}
              onChange={setGenPlan}
              options={[
                { value: 'monthly', label: `${t('subscription.monthly')} ($25)` },
                { value: 'yearly', label: `${t('subscription.yearly')} ($250)` },
              ]}
            />
          </div>
          <div className="w-24">
            <label className="label">{t('admin.count')}</label>
            <input type="number" min="1" max="50" className="input" value={genCount} onChange={(e) => setGenCount(e.target.value)} />
          </div>
          <button type="submit" disabled={codeBusy} className="btn-primary">{codeBusy ? t('common.loading') : t('admin.generateCodes')}</button>
        </form>

        {newCodes.length > 0 && (
          <div className="rounded-xl border border-gold-400/30 bg-gold-400/5 p-3">
            <p className="mb-2 text-sm font-semibold text-gold-200">{t('admin.newCodes')}</p>
            <div className="flex flex-wrap gap-2">
              {newCodes.map((c) => (
                <code key={c} className="rounded-lg bg-black/40 px-3 py-1.5 font-mono text-sm text-gold-300" dir="ltr">{c}</code>
              ))}
            </div>
          </div>
        )}

        {/* قائمة الأكواد */}
        {codes === null ? <Spinner /> : codes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gold-400/15 text-stone-400">
                <tr>
                  <th className="p-2 text-start font-medium">{t('admin.code')}</th>
                  <th className="p-2 text-start font-medium">{t('admin.plan')}</th>
                  <th className="p-2 text-start font-medium">{t('admin.status')}</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.code} className="border-b border-white/5 last:border-0">
                    <td className="p-2 font-mono text-gold-300" dir="ltr">{c.code}</td>
                    <td className="p-2 text-stone-300">{t(`subscription.${c.plan}`)}</td>
                    <td className="p-2">
                      <span className={`badge ${c.used ? 'bg-stone-600/40 text-stone-300' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {c.used ? `${t('admin.usedBadge')}${c.usedEmail ? ` · ${c.usedEmail}` : ''}` : t('admin.available')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* تعليمات الدفع */}
      <form onSubmit={savePayment} className="glass space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-stone-100">💳 {t('admin.paymentTitle')}</h2>
        <p className="text-xs text-stone-400">{t('admin.paymentHint')}</p>
        {payMsg && <Alert ok>{payMsg}</Alert>}
        <textarea rows={4} className="input resize-none" value={payInfo} onChange={(e) => setPayInfo(e.target.value)}
          placeholder="مثال: للاشتراك حوّل المبلغ إلى محفظة PalPay رقم ... أو حساب بنكي ...، ثم تواصل لاستلام كود التفعيل." />
        <button type="submit" disabled={payBusy} className="btn-primary">{payBusy ? t('common.loading') : t('admin.savePayment')}</button>
      </form>

      {/* إعادة تعيين كلمة مرور مشترك */}
      <form onSubmit={doReset} className="glass space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-stone-100">🔓 {t('admin.resetSection')}</h2>
        <p className="text-xs text-stone-400">{t('admin.resetHint')}</p>
        {rMsg && <Alert ok>{rMsg}</Alert>}
        {rErr && <Alert>{rErr}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t('admin.userEmail')}</label>
            <input type="email" required dir="ltr" className="input" value={rf.email} onChange={(e) => setRf({ ...rf, email: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('admin.newPassword')}</label>
            <div className="flex gap-2">
              <input type="text" required dir="ltr" className="input" value={rf.newPassword} onChange={(e) => setRf({ ...rf, newPassword: e.target.value })} />
              <button type="button" onClick={() => setRf({ ...rf, newPassword: genPassword() })} className="btn-ghost shrink-0 !px-3 text-xs">{t('admin.generate')}</button>
            </div>
          </div>
        </div>
        <button type="submit" disabled={rBusy} className="btn-primary">{rBusy ? t('common.loading') : t('admin.doReset')}</button>
      </form>
    </div>
  );
}
