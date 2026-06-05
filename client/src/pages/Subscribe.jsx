import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Seo from '../components/Seo.jsx';
import Spinner from '../components/Spinner.jsx';

const PLANS = [
  { key: 'monthly', price: 10, per: 'perMonth' },
  { key: 'yearly', price: 100, per: 'perYear', badge: 'save2months' },
];

export default function Subscribe() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [selected, setSelected] = useState(null); // الخطة المختارة
  const [form, setForm] = useState({ method: '', reference: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const load = () =>
    api
      .get('/subscription/status')
      .then((r) => {
        // المفعّل (مثل المدير) لا يحتاج دفعاً → للوحة التحكم
        if (r.data.active) navigate('/dashboard');
        else setStatus(r.data);
      })
      .catch(() => setStatus({}));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/subscription/request', { plan: selected, ...form });
      setSent(true);
      await refresh();
      load();
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <Spinner full />;

  // تم إرسال الطلب أو هناك طلب معلّق
  if (sent || status.pending) {
    return (
      <div className="mx-auto max-w-md">
        <Seo title={t('subscription.title')} />
        <div className="glass-strong animate-fade-up p-8 text-center">
          <p className="mb-3 text-5xl">⏳</p>
          <h1 className="font-display text-2xl font-bold gradient-text">{t('subscription.pendingTitle')}</h1>
          <p className="mt-3 text-stone-300">{t('subscription.pendingDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Seo title={t('subscription.title')} />
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-extrabold gradient-text sm:text-4xl">{t('subscription.title')}</h1>
        <p className="mt-3 text-stone-300">{t('subscription.subtitle')}</p>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {!selected ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {PLANS.map((p) => (
            <div key={p.key} className={`glass-strong relative flex flex-col p-7 ${p.key === 'yearly' ? 'ring-1 ring-gold-400/50' : ''}`}>
              {p.badge && <span className="badge absolute end-5 top-5 bg-gold-400 text-ink-950">{t(`subscription.${p.badge}`)}</span>}
              <h2 className="font-display text-xl font-bold text-stone-100">{t(`subscription.${p.key}`)}</h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl font-extrabold gradient-text">${p.price}</span>
                <span className="text-stone-400">{t(`subscription.${p.per}`)}</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-stone-400">{t('subscription.features')}</p>
              <button onClick={() => setSelected(p.key)} className="btn-primary mt-6 w-full">{t('subscription.choose')}</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-strong mx-auto max-w-lg animate-fade-up p-7">
          <button onClick={() => setSelected(null)} className="mb-4 text-sm text-gold-300 hover:text-gold-200">← {t('subscription.back')}</button>
          <h2 className="font-display text-xl font-bold gradient-text">
            {t('subscription.payTitle', { plan: t(`subscription.${selected}`) })}
          </h2>

          {/* تعليمات الدفع */}
          <div className="mt-4 rounded-xl border border-gold-400/20 bg-black/30 p-4">
            <p className="mb-1 text-sm font-semibold text-gold-200">💳 {t('subscription.payInstructions')}</p>
            <p className="whitespace-pre-line text-sm text-stone-300">{status.paymentInfo}</p>
          </div>

          {/* نموذج إثبات الدفع */}
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="label">{t('subscription.method')}</label>
              <input type="text" className="input" placeholder={t('subscription.methodPlaceholder')} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('subscription.reference')}</label>
              <textarea rows={2} className="input resize-none" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              <p className="mt-1 text-xs text-stone-400">{t('subscription.referenceHint')}</p>
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? t('common.loading') : t('subscription.submitRequest')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
