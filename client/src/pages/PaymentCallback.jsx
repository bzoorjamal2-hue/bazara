import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { PartyIcon, WarnIcon, ReceiptIcon, DownloadIcon, PrintIcon, TruckIcon, CopyIcon, CheckIcon } from '../components/icons.jsx';
import Seo from '../components/Seo.jsx';
import Spinner from '../components/Spinner.jsx';
import { printReceipt, saveReceiptImage } from '../utils/receipt.js';
import { sizeLabel } from '../utils/sizes.js';
import { copyText } from '../utils/links.js';

export default function PaymentCallback() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language !== 'en';
  const { clear } = useCart();
  const [params] = useSearchParams();
  // Paytabs يرجّع tranRef، Lahza يرجّع reference/trxref
  const reference = params.get('cartId') || params.get('reference') || params.get('trxref') || '';
  const [state, setState] = useState('verifying'); // verifying | paid | failed
  // لقطةُ الطلبِ من الخادم: الزبونةُ عادت من صفحةِ البنكِ بتبويبٍ فقد سلّتَه،
  // فبلا هذه اللقطةِ لا شهادةَ شراءٍ لمن دفعت فعلاً — وهي أحوجُ إليها من غيرها.
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!reference) { setState('failed'); return; }
    // ننتظر ثانية ونصف — Paytabs callback بالخلفية ياخد لحظة ليسجّل الدفع
    const id = setTimeout(() => {
      api
        .get(`/orders/verify/${reference}`)
        .then((r) => {
          if (r.data.status === 'paid') {
            setState('paid');
            // المقاسُ مخزَّنٌ برمزِه (`one`)، والشهادةُ تُقرأُ لا تُفكَّك — نُسمّيه
            if (r.data.order) {
              const o = r.data.order;
              setOrder({
                ...o,
                paymentMethod: 'card',
                items: (Array.isArray(o.items) ? o.items : []).map((i) => ({ ...i, size: i.size ? sizeLabel(i.size, t) : '' })),
              });
            }
            clear();
          } else setState('failed');
        })
        .catch(() => setState('failed'));
    }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const takeReceipt = async (kind) => {
    if (!order || busy) return;
    setBusy(kind);
    setErr('');
    try {
      if (kind === 'print') printReceipt(order, t, ar ? 'rtl' : 'ltr');
      else await saveReceiptImage(order, t, ar ? 'rtl' : 'ltr');
    } catch {
      setErr(t('receipt.failed'));
    } finally {
      setBusy('');
    }
  };

  const copyRef = async () => {
    if (await copyText(order?.reference || reference)) { setCopied(true); setTimeout(() => setCopied(false), 1600); }
  };

  return (
    <div className="mx-auto max-w-md text-center">
      <Seo title={t('checkout.title')} />
      <div className="bz-panel animate-fade-up p-8">
        {state === 'verifying' && (
          <>
            <Spinner />
            <p className="text-gold-200">{t('checkout.verifying')}</p>
          </>
        )}
        {state === 'paid' && (
          <>
            <p className="mb-3 flex justify-center text-emerald-500"><PartyIcon className="h-16 w-16" /></p>
            <h1 className="bz-ph-t !text-2xl">{t('checkout.success')}</h1>
            {/* ما سُدِّد وما بقي — أوّلَ ما تقعُ عليه العينُ بعد العودةِ من البنك.
                البطاقةُ حملت ثمنَ المنتجاتِ وحدَه، ورسومُ التوصيلِ تُدفَعُ نقداً
                للمندوب؛ وبلا قولِ ذلك هنا يُفاجَأُ الزبونُ بمبلغٍ عند الباب. */}
            {order && (
              <div className="mt-4 rounded-2xl border border-gold-400/25 bg-gold-400/[0.08] p-4 text-start">
                <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-300">
                  <CheckIcon className="h-4 w-4 shrink-0" /> {t('checkout.paidGoods')}
                </p>
                {Number(order.codDue) > 0 && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-stone-300">
                    <TruckIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-200" />
                    {t('checkout.dueCourier', { amount: `${t('common.currency')}${Number(order.codDue).toFixed(2)}` })}
                  </p>
                )}
              </div>
            )}

            {/* رقمُ الطلب — تُنسَخُ بضغطةٍ وتُلصَقُ بأيّ استفسار */}
            {(order?.reference || reference) && (
              <button
                type="button" onClick={copyRef} title={t('co.doneCopy')}
                className="group mt-5 w-full rounded-2xl bg-gold-400/10 px-6 py-3 ring-1 ring-gold-400/30 transition hover:bg-gold-400/15"
              >
                <span className="text-xs text-stone-400">{t('co.doneRef')}</span>
                <p dir="ltr" className="flex items-center justify-center gap-1.5 font-mono text-lg font-bold tracking-wide text-gold-200">
                  {order?.reference || reference}
                  {copied
                    ? <CheckIcon className="h-4 w-4 text-emerald-300" />
                    : <CopyIcon className="h-4 w-4 text-gold-200/60 transition group-hover:text-gold-200" />}
                </p>
                <span className="text-[10px] text-stone-500">{copied ? t('co.doneCopied') : t('co.doneCopy')}</span>
              </button>
            )}

            {/* شهادةُ الشراء — نفسُ ورقةِ الدفعِ عند الاستلام، بختمِ «مدفوع بالبطاقة» */}
            {order && (
              <div className="mt-3 rounded-2xl border border-gold-400/20 bg-gold-400/[0.06] p-3.5 text-start">
                <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-gold-200">
                  <ReceiptIcon className="h-4 w-4 shrink-0" /> {t('checkout.receiptTitle')}
                </p>
                <p className="mb-2.5 text-[11px] leading-relaxed text-stone-400">{t('receipt.hint')}</p>
                <div className="flex gap-2">
                  <button
                    type="button" onClick={() => takeReceipt('image')} disabled={Boolean(busy)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gold-400/15 py-2.5 text-xs font-bold text-gold-200 ring-1 ring-gold-400/30 transition hover:bg-gold-400/25 disabled:opacity-50"
                  >
                    <DownloadIcon className="h-4 w-4 shrink-0" />
                    {busy === 'image' ? t('common.loading') : t('receipt.saveImage')}
                  </button>
                  <button
                    type="button" onClick={() => takeReceipt('print')} disabled={Boolean(busy)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gold-400/25 py-2.5 text-xs font-bold text-stone-300 transition hover:bg-gold-400/10 disabled:opacity-50"
                  >
                    <PrintIcon className="h-4 w-4 shrink-0" /> {t('receipt.print')}
                  </button>
                </div>
                {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <Link
                to={order?.storeSlug ? `/track?store=${order.storeSlug}` : '/track'}
                className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 bz-buy font-bold ring-1 ring-[#BAB9B7]/35 transition hover:brightness-110"
               
              >
                <TruckIcon className="h-5 w-5 shrink-0" /> {t('co.doneTrack')}
              </Link>
              <Link to="/" className="w-full rounded-full border border-gold-400/25 py-3 font-semibold text-stone-300 transition hover:bg-gold-400/10">
                {t('checkout.backToStore')}
              </Link>
            </div>
          </>
        )}
        {state === 'failed' && (
          <>
            <p className="mb-3 flex justify-center text-red-400"><WarnIcon className="h-16 w-16" /></p>
            <h1 className="font-display text-xl font-bold text-red-300">{t('checkout.failed')}</h1>
            <Link to="/" className="btn-ghost mt-6 inline-block">{t('checkout.backToStore')}</Link>
          </>
        )}
      </div>
    </div>
  );
}
