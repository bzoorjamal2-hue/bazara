import { useEffect, useRef, useState } from 'react';
import useSessionState from '../hooks/useSessionState.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import StoreHeader from '../components/StoreHeader.jsx';
import StoreFooter from '../components/StoreFooter.jsx';
import { PackageIcon, CheckIcon, SearchIcon, TruckIcon, CartIcon, XIcon, BackIcon } from '../components/icons.jsx';
import { PageTitle, StateCard } from '../components/PageUI.jsx';
import { goBack } from '../utils/nav.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { useCart } from '../context/CartContext.jsx';

const STEPS = ['new', 'confirmed', 'shipped', 'delivered'];
const BADGE = {
  new: 'bz-ob',
  confirmed: 'bz-ob',
  shipped: 'bz-ob bz-ob-on',
  delivered: 'bz-ob bz-ob-ok',
  cancelled: 'bz-ob bz-ob-no',
};

export default function Track() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const navigate = useNavigate();
  // نطاق متجر (?store=slug): جاء المستخدم من متجر — فرجوعه إليه لا للموقع العام،
  // ونعرض فوتر المتجر بأسفل الصفحة (هوية المتجر حتى النهاية زي صفحة المنتج).
  const storeScope = (new URLSearchParams(useLocation().search).get('store') || '').trim();
  const [storeObj, setStoreObj] = useState(() => (storeScope && getCache(`store:${storeScope}`)?.store) || null);
  useEffect(() => {
    if (!storeScope) { setStoreObj(null); return; }
    const cached = getCache(`store:${storeScope}`);
    if (cached?.store) setStoreObj(cached.store);
    api.get(`/public/store/${storeScope}`)
      .then((r) => { setCache(`store:${storeScope}`, r.data); setStoreObj(r.data.store); })
      .catch(() => { /* الفوتر لا يظهر إن فشل الجلب */ });
  }, [storeScope]);
  // رقمها يبقى بالعودة للصفحة: كانت تكتبه ثم تخرج لتتأكّد منه فترجع لحقلٍ فارغ
  const [phone, setPhone] = useSessionState('track:phone', '');
  const [orders, setOrders] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { add, setOpen } = useCart();
  const [reordering, setReordering] = useState(''); // reference الطلب الجاري إعادته
  const [copiedRef, setCopiedRef] = useState(''); // رقم الطلب المنسوخ للتو (تأكيد بصري)
  const [copiedTrack, setCopiedTrack] = useState(''); // رقم تتبّع الشحنة المنسوخ للتو

  // إعادة الطلب بضغطة: نجلب كل منتج بحالته الحالية (سعر/مخزون) ونضيفه للسلة بنفس
  // الكمية والمقاس واللون — المنتجات المحذوفة/الناقصة تُتجاهل بهدوء.
  const reorder = async (o) => {
    if (reordering) return;
    setReordering(o.reference);
    let added = 0;
    const wanted = (o.items || []).filter((it) => it.id);
    try {
      // طلب واحد لكل القطع (كانت طلبات متسلسلة: قطعة تنتظر التي قبلها)
      const r = await api.get(`/public/products?ids=${wanted.map((it) => it.id).join(',')}`);
      const byId = new Map((r.data.products || []).map((p) => [p.id, p]));
      for (const it of wanted) {
        const p = byId.get(it.id);
        if (!p) continue; // محذوف أو متجره غير فعّال — نتجاهله بهدوء
        // نفد المخزون: صفر عام أو نفاد كل كميات الألوان/النمر (النموذج التفصيلي)
        const detailed = p.colorStock && Object.keys(p.colorStock).length
          ? Object.values(p.colorStock).flatMap((sz) => Object.values(sz || {})).filter((q) => typeof q === 'number')
          : (p.sizeStock ? Object.values(p.sizeStock).filter((q) => typeof q === 'number') : []);
        const soldOut = p.stock === 0 || (detailed.length > 0 && detailed.reduce((a, b) => a + b, 0) === 0);
        if (soldOut) continue;
        add({ ...p, size: it.size || '', color: it.color || '', whatsapp: p.storeWhatsapp }, Math.max(1, Number(it.qty) || 1));
        added += 1;
      }
    } catch { /* فشل الجلب — نُظهر رسالة "لا يوجد ما يُعاد" أدناه */ }
    setReordering('');
    if (added > 0) setOpen(true);
    else setError(t('track.reorderEmpty'));
  };

  const doSearch = async (ph) => {
    if (!ph.trim()) return;
    setBusy(true); setError(''); setOrders(null);
    try {
      const r = await api.post('/public/track', { phone: ph.trim() });
      setOrders(r.data.orders);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const search = (e) => { e.preventDefault(); doSearch(phone); };

  // ما بعد الشراء بلا احتكاك: نعبّئ الرقم المحفوظ من آخر طلب ونبحث تلقائياً —
  // الزبونة تفتح "تتبّعي طلبك" فترى طلباتها فوراً بلا إعادة كتابة رقمها كل مرة
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem('bz_customer_v1') || '{}');
      const ph = String(saved.phone || '').trim();
      if (ph.replace(/\D/g, '').length >= 9) { setPhone(ph); doSearch(ph); }
    } catch { /* تجاهل */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Seo title={t('track.title')} />
      {/* بنطاق متجر: نلبس هيدر المتجر (اسمه/شعاره/بحثه) بدل شريط بازارا العام —
          الزبونة تبقى داخل المتجر بصرياً من الهيدر حتى الفوتر. */}
      {storeObj && (
        <StoreHeader
          store={storeObj}
          q=""
          setQ={() => {}}
          cat="all"
          setCat={(c) => navigate(c && c !== 'all' ? `/store/${storeScope}?cat=${encodeURIComponent(c)}` : `/store/${storeScope}`)}
          products={[]}
        />
      )}
      <div className={`mx-auto w-full max-w-2xl${storeObj ? ' flex-1' : ''}`}>
        {/* رجوع + عنوان مزخرف مركزي (بنفس روح عناوين المتجر). زر الرجوع للموقع العام
            فقط — داخل المتجر يتكفّل هيدر المتجر/الشريط السفلي بالتنقّل. */}
        {!storeObj && (
          <div className="mb-2 flex items-center">
            <button
              onClick={() => goBack(navigate, '/shop')}
              aria-label={t('common.back')}
              className="bz-iconbtn app-tap"
            >
              <BackIcon className="h-5 w-5" />
            </button>
          </div>
        )}
        <PageTitle icon={<PackageIcon className="h-6 w-6" />} title={t('track.title')} sub={t('track.hint')} />

        {/* نموذج البحث — بطاقة فاخرة بحقل حبّي وزر خمري ناري */}
        <form onSubmit={search} className="bz-panel p-4">
          <div className="flex gap-2">
            {/* الحقل ltr داخل صفحة rtl → نموضع الأيقونة والحشوة فيزيائياً (يسار) حتى لا يغطيها النص */}
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="bz-field-ico pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                className={`bz-field pl-10 text-end ${phone ? 'pr-10' : 'pr-4'}`}
                placeholder={t('track.phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {/* مسح الرقم: تصحيح رقم مكتوب كان يتطلّب حذفاً حرفاً حرفاً.
                  يمينٌ فيزيائي لأن الحقل ltr والنصّ ينتهي هناك. */}
              {phone && (
                <button
                  type="button"
                  onClick={() => setPhone('')}
                  title={t('common.clear')} aria-label={t('common.clear')}
                  className="bz-field-x absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="bz-act shrink-0 px-6"
            >
              {busy ? '…' : t('track.search')}
            </button>
          </div>
        </form>

        {error && <p className="bz-err mt-4">{error}</p>}

        {/* النتائج */}
        {orders && (
          orders.length === 0 ? (
            <div className="mt-6">
              <StateCard icon={<PackageIcon className="h-7 w-7" />} text={t('track.notFound')} />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {orders.map((o) => {
                const cancelled = o.status === 'cancelled';
                const stepIdx = STEPS.indexOf(o.status);
                return (
                  <div key={o.reference} className="bz-panel p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-base font-bold text-[#3f2e22] dark:text-inherit">{o.storeName}</span>
                        {/* رقم الطلب ينُسخ بضغطة (لإرساله للمتجر عند الاستفسار) */}
                        <button
                          type="button"
                          onClick={() => { try { navigator.clipboard.writeText(o.reference); setCopiedRef(o.reference); setTimeout(() => setCopiedRef(''), 1500); } catch { /* تجاهل */ } }}
                          className="bz-ref ms-2 rounded-full px-2 py-0.5 font-mono text-[11px]"
                          dir="ltr"
                          title={t('co.doneCopy')}
                        >
                          {copiedRef === o.reference ? t('common.copied') : o.reference}
                        </button>
                      </div>
                      <span className={BADGE[o.status] || 'bz-ob'}>
                        {t(`dashboard.ordersSection.${o.status}`)}
                      </span>
                    </div>

                    {/* الخط الزمني الفاخر: منجز = خمري بعلامة ✓، الحالي ينبض بهالة ذهبية، القادم باهت */}
                    {!cancelled && (
                      <div className="mt-5 flex items-center" dir={rtl ? 'rtl' : 'ltr'}>
                        {STEPS.map((s, i) => {
                          const done = i <= stepIdx;
                          const current = i === stepIdx;
                          return (
                            <div key={s} className="flex flex-1 items-center last:flex-none">
                              <div className="flex flex-col items-center">
                                <span className="relative flex h-9 w-9 items-center justify-center">
                                  <span
                                    className={`bz-tl-dot ${done ? 'bz-tl-done' : ''} ${current ? 'bz-tl-now' : ''}`}
                                  >
                                    {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
                                  </span>
                                </span>
                                <span className={`bz-tl-lbl ${done ? 'bz-tl-lbl-on' : ''}`}>{t(`dashboard.ordersSection.${s}`)}</span>
                              </div>
                              {i < STEPS.length - 1 && (
                                <span className={`bz-tl-bar ${i < stepIdx ? 'bz-tl-bar-on' : ''}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* شركة التوصيل: الحالة الحيّة عند الشركة + رقم التتبّع (يظهر بعد إرسال الشحنة) */}
                    {o.courier && (
                      <div className="bz-note mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 text-xs">
                        <span className="flex items-center gap-1.5 font-bold">
                          <TruckIcon className="h-4 w-4" /> {t('track.courier')}: {o.courier}
                        </span>
                        {o.courierStatus && (
                          <span className="bz-ref rounded-full px-2.5 py-0.5 font-semibold">{o.courierStatus}</span>
                        )}
                        {o.tracking && (
                          <span className="text-stone-500">
                            {t('track.trackingNo')}:{' '}
                            <button
                              type="button"
                              onClick={() => { try { navigator.clipboard.writeText(o.tracking); setCopiedTrack(o.tracking); setTimeout(() => setCopiedTrack(''), 1500); } catch { /* تجاهل */ } }}
                              dir="ltr"
                              title={t('co.doneCopy')}
                              className="bz-ref rounded-full px-1.5 font-mono font-semibold"
                            >
                              {copiedTrack === o.tracking ? t('common.copied') : o.tracking}
                            </button>
                          </span>
                        )}
                      </div>
                    )}

                    {/* المنتجات */}
                    <ul className="bz-hr-t mt-4 space-y-1 pt-3 text-sm text-stone-600">
                      {(o.items || []).map((it, i) => (
                        <li key={i} className="flex items-baseline gap-1.5">
                          <span aria-hidden className="bz-bullet text-[8px]">◆</span>
                          <span className="min-w-0 flex-1">{it.name}{it.color ? ` - ${it.color}` : ''}{it.size ? ` (${it.size})` : ''} ×{it.qty}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-stone-400">
                        {new Date(o.createdAt).toLocaleDateString()}
                        {' · '}
                        {(o.items || []).reduce((s, it) => s + (Number(it.qty) || 1), 0)} {t('store.products')}
                      </span>
                      <span className="bz-total text-lg font-bold">{t('common.currency')}{o.total.toFixed(2)}</span>
                    </div>
                    {/* إعادة الطلب بضغطة — نفس القطع بالمقاسات والألوان (بأسعار اليوم) */}
                    <button
                      onClick={() => reorder(o)}
                      disabled={Boolean(reordering)}
                      className="bz-act-2 mt-3 w-full"
                    >
                      <CartIcon className="h-4 w-4" /> {reordering === o.reference ? t('common.loading') : t('track.reorder')}
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* فوتر المتجر — يظهر فقط عند الدخول من متجر (?store=) فتبقى هوية المتجر حتى النهاية */}
      {storeObj && <StoreFooter store={storeObj} wa={storeObj.whatsapp || storeObj.ownerPhone || ''} />}
    </>
  );
}
