import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { CardIcon, KeyIcon, BackIcon, CheckIcon } from '../components/icons.jsx';
import Seo from '../components/Seo.jsx';
import Spinner from '../components/Spinner.jsx';
import { PageTitle, Act } from '../components/PageUI.jsx';

// بالشيكل — حسابُ PayTabs يقبضُ ILS. تُطابقُ PLAN_PRICES بالخادم
const PLANS = [
  { key: 'monthly', price: 80, per: 'perMonth' },
  { key: 'yearly', price: 760, per: 'perYear' },
];

export default function Subscribe() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [selected, setSelected] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const load = () =>
    api
      .get('/subscription/status')
      .then((r) => {
        if (r.data.active) navigate('/dashboard');
        else setStatus(r.data);
      })
      .catch(() => setStatus({}));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // التحقّق من دفع الاشتراك بعد العودة من Paytabs
  const returnRef = params.get('ref');
  useEffect(() => {
    if (!returnRef) return;
    setVerifying(true);
    const check = () =>
      api.get(`/subscription/verify?ref=${encodeURIComponent(returnRef)}`)
        .then(async (r) => {
          if (r.data.status === 'paid') {
            await refresh();
            navigate('/dashboard');
          } else {
            setVerifying(false);
            setError(t('subscription.paymentPending'));
          }
        })
        .catch(() => { setVerifying(false); });
    const id = setTimeout(check, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnRef]);

  const redeem = async (e) => {
    e.preventDefault();
    setError('');
    if (!code.trim()) { setError(t('subscription.enterCode')); return; }
    setBusy(true);
    try {
      await api.post('/subscription/redeem', { code: code.trim() });
      await refresh();
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  const payWithCard = async () => {
    if (!selected) return;
    setError('');
    setCardBusy(true);
    try {
      const r = await api.post('/subscription/checkout', { plan: selected });
      if (r.data?.redirectUrl) {
        window.location.href = r.data.redirectUrl;
      } else {
        setError(t('subscription.cardError'));
      }
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setCardBusy(false);
    }
  };

  if (verifying) return <div className="mx-auto max-w-md p-8 text-center"><Spinner /><p className="mt-4 text-gold-200">{t('subscription.verifyingPayment')}</p></div>;
  if (!status) return <Spinner full />;

  return (
    <div className="mx-auto max-w-3xl">
      <Seo title={t('subscription.title')} />
      <PageTitle icon={<CardIcon className="h-6 w-6" />} title={t('subscription.title')} sub={t('subscription.subtitle')} />

      {error && <p className="bz-err mb-5">{error}</p>}

      {!selected ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {PLANS.map((p) => (
            <div key={p.key} className={`bz-panel relative flex flex-col p-7 ${p.key === 'yearly' ? 'bz-plan-top' : ''}`}>
              {p.badge && <span className="bz-pb absolute end-5 top-5">{t(`subscription.${p.badge}`)}</span>}
              <h2 className="bz-state-t">{t(`subscription.${p.key}`)}</h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="bz-price">{t('common.currency')}{p.price}</span>
                <span className="bz-state-p">{t(`subscription.${p.per}`)}</span>
              </div>
              <p className="bz-state-p mt-4">{t('subscription.features')}</p>
              <Act onClick={() => setSelected(p.key)} className="mt-6 w-full !py-3.5">
                {t('subscription.choose')}
              </Act>
            </div>
          ))}
        </div>
      ) : (
        <div className="bz-panel mx-auto max-w-lg animate-fade-up p-7">
          <button type="button" onClick={() => setSelected(null)} className="bz-mini-btn mb-4 inline-flex items-center gap-1"><BackIcon className="h-3.5 w-3.5" /> {t('subscription.back')}</button>
          <h2 className="bz-ph-t !text-xl">
            {t('subscription.payTitle', { plan: t(`subscription.${selected}`) })}
          </h2>

          {/* زر الدفع بالفيزا */}
          <button
            onClick={payWithCard}
            disabled={cardBusy || busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #1a1a6c 0%, #1e3a5f 50%, #1e6a4f 100%)' }}
          >
            {cardBusy ? t('common.loading') : <><span>💳</span> {t('subscription.payWithCard')}</>}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-stone-500">{t('subscription.cardNote')}</p>

          {/* فاصل "أو" */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gold-400/20" />
            <span className="text-xs font-bold text-stone-500">{t('subscription.or')}</span>
            <div className="h-px flex-1 bg-gold-400/20" />
          </div>

          {/* تعليمات الدفع (التحويل المباشر) */}
          <div className="bz-note p-4">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-bold"><CardIcon className="h-4 w-4" /> {t('subscription.payInstructions')}</p>
            <p className="bz-state-p whitespace-pre-line !text-start">{status.paymentInfo}</p>
          </div>

          {/* إدخال كود التفعيل */}
          <form onSubmit={redeem} className="mt-5 space-y-3">
            <label className="bz-sub-h flex items-center gap-1.5"><KeyIcon className="h-4 w-4" /> {t('subscription.haveCode')}</label>
            <input
              type="text"
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              className="bz-field !rounded-2xl text-center text-2xl font-bold tracking-[0.5em]"
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <p className="bz-state-p !text-xs !text-start">{t('subscription.codeHint')}</p>
            <button type="submit" disabled={busy} className="bz-act w-full">
              {busy ? t('common.loading') : t('subscription.activate')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
