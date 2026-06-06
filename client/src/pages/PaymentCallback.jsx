import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import Seo from '../components/Seo.jsx';
import Spinner from '../components/Spinner.jsx';

export default function PaymentCallback() {
  const { t } = useTranslation();
  const { clear } = useCart();
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';
  const [state, setState] = useState('verifying'); // verifying | paid | failed

  useEffect(() => {
    if (!reference) { setState('failed'); return; }
    api
      .get(`/orders/verify/${reference}`)
      .then((r) => {
        if (r.data.status === 'paid') { setState('paid'); clear(); }
        else setState('failed');
      })
      .catch(() => setState('failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  return (
    <div className="mx-auto max-w-md text-center">
      <Seo title={t('checkout.title')} />
      <div className="glass-strong animate-fade-up p-8">
        {state === 'verifying' && (
          <>
            <Spinner />
            <p className="text-gold-200">{t('checkout.verifying')}</p>
          </>
        )}
        {state === 'paid' && (
          <>
            <p className="mb-3 text-6xl">🎉</p>
            <h1 className="font-display text-2xl font-bold gradient-text">{t('checkout.success')}</h1>
            <Link to="/" className="btn-primary mt-6 inline-block">{t('checkout.backToStore')}</Link>
          </>
        )}
        {state === 'failed' && (
          <>
            <p className="mb-3 text-6xl">⚠️</p>
            <h1 className="font-display text-xl font-bold text-red-300">{t('checkout.failed')}</h1>
            <Link to="/" className="btn-ghost mt-6 inline-block">{t('checkout.backToStore')}</Link>
          </>
        )}
      </div>
    </div>
  );
}
