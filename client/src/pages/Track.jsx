import { useEffect, useRef, useState } from 'react';
import useSessionState from '../hooks/useSessionState.js';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import Seo from '../components/Seo.jsx';
import StoreHeader from '../components/StoreHeader.jsx';
import StoreFooter from '../components/StoreFooter.jsx';
import { PackageIcon, CheckIcon, SearchIcon, TruckIcon, CartIcon, XIcon, BackIcon, StoreIcon, CopyIcon, PinIcon, ClockIcon, CashIcon, DownloadIcon, PrintIcon, WhatsAppIcon } from '../components/icons.jsx';
import { PageTitle, StateCard } from '../components/PageUI.jsx';
import { goBack } from '../utils/nav.js';
import { getCache, setCache } from '../utils/apiCache.js';
import { trackPath, copyText } from '../utils/links.js';
import { useCart } from '../context/CartContext.jsx';
import { cldThumb } from '../utils/cloudinary.js';
import { sizeLabel } from '../utils/sizes.js';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import { printReceipt, saveReceiptImage } from '../utils/receipt.js';

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
  // اسمُ المتجرِ من المسار (/store/<المتجر>/track)، ومن ?store= للروابطِ القديمة
  const { slug: pathSlug } = useParams();
  const { pathname: trackPathname, search: trackSearch } = useLocation();
  const storeScope = (pathSlug || new URLSearchParams(trackSearch).get('store') || '').trim();
  // رابطٌ قديمٌ (/track?store=) → المسارُ الحاملُ اسمَ المتجر، بلا خطوةٍ بسجلِّ الرجوع
  useEffect(() => {
    if (!storeScope || pathSlug) return;
    const rest = new URLSearchParams(trackSearch);
    rest.delete('store');
    const qs = rest.toString();
    navigate(`${trackPath(storeScope)}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [storeScope, pathSlug, trackSearch, trackPathname, navigate]);

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
  const [busyReceipt, setBusyReceipt] = useState(''); // "<reference>:<image|print>" أثناء توليد الشهادة

  // تاريخٌ ووقتٌ بصيغةٍ محليّةٍ مقروءة — «الأحد ٢٨ حزيران · ٩:٤٤ م».
  // ar-PS لا ar: الأخيرةُ تُسمّي الشهورَ مصريّاً (يونيو/يوليو) وأهلُ البلادِ
  // يقولون حزيران وتمّوز — والتاريخُ يُقرأُ بلغةِ قارئِه لا بلغةِ المعيار.
  const fmtDate = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const loc = i18n.language === 'en' ? 'en-GB' : 'ar-PS';
    const day = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
    const time = d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' });
    return `${day} · ${time}`;
  };
  // متى بلغَ الطلبُ مرحلةً بعينها. «جديد» لحظةُ إنشائِه، وما بعدَها من status_at —
  // والطلباتُ التي سبقت هذا العمودَ تُرجعُ فراغاً فيُعرَضُ بدلَه شرطة.
  const stamp = (o, step) => fmtDate(step === 'new' ? o.createdAt : o.statusAt?.[step]);

  // شهادةُ الشراءِ من صفحةِ التتبّع: مَن عاد بعد أيّامٍ يجدُها هنا، لا بشاشةِ
  // النجاحِ التي مرّت مرّةً وانتهت.
  const takeReceipt = async (o, kind) => {
    if (busyReceipt) return;
    setBusyReceipt(`${o.reference}:${kind}`);
    setError('');
    const order = {
      ...o,
      subtotal: Math.max(0, o.total - (o.deliveryFee || 0)) + (o.discount || 0),
      items: (o.items || []).map((it) => ({ ...it, size: it.size ? sizeLabel(it.size, t) : '' })),
      eta: o.etaTier ? t(`co.eta.${o.etaTier}`, { defaultValue: '' }) : '',
    };
    try {
      if (kind === 'print') printReceipt(order, t, rtl ? 'rtl' : 'ltr');
      else await saveReceiptImage(order, t, rtl ? 'rtl' : 'ltr');
    } catch {
      setError(t('receipt.failed'));
    } finally {
      setBusyReceipt('');
    }
  };

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
        {/* الرجوعُ ظاهرٌ دائماً.
            كان مشروطاً بـ‏!storeObj‎، فمن يفتحُ التتبّعَ من متجرٍ لا يجدُ مخرجاً
            إلّا زرَّ المتصفّح. والوجهةُ تختلف: داخلَ المتجرِ نعودُ إليه، وخارجَه
            للصفحةِ السابقةِ أو للتسوّق. */}
        <div className="mb-2 flex items-center">
          <button
            onClick={() => (storeScope ? navigate(`/store/${storeScope}`) : goBack(navigate, '/shop'))}
            aria-label={t('common.back')}
            className="bz-iconbtn app-tap"
          >
            <BackIcon className="h-5 w-5" />
          </button>
        </div>
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
                // طلبُ بطاقةٍ لم تكتملْ دفعتُه — ليس بمسارِ التجهيزِ بعد
                const unpaid = o.status === 'pending' || o.status === 'failed';
                const stepIdx = STEPS.indexOf(o.status);
                const goods = Math.max(0, o.total - (o.deliveryFee || 0));
                const subtotal = goods + (o.discount || 0);
                const prepaid = o.paymentMethod === 'card';
                const eta = o.etaTier ? t(`co.eta.${o.etaTier}`, { defaultValue: '' }) : '';
                return (
                  <div key={o.reference} className="bz-panel overflow-hidden">
                    {/* ── الترويسة: هويّةُ المتجرِ ورقمُ الطلبِ وحالتُه ── */}
                    <div className="bz-tr-head flex flex-wrap items-center gap-3 p-5">
                      {o.storeLogo
                        ? <img src={cldThumb(o.storeLogo, 96)} alt={o.storeName} loading="lazy" className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-[#4B4A49]/20" />
                        : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#4B4A49]/10 text-[#4B4A49]"><StoreIcon className="h-5 w-5" /></span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-[#313130] dark:text-inherit">{o.storeName}</p>
                        {/* رقم الطلب ينُسخ بضغطة (لإرساله للمتجر عند الاستفسار) */}
                        <button
                          type="button"
                          onClick={async () => { if (await copyText(o.reference)) { setCopiedRef(o.reference); setTimeout(() => setCopiedRef(''), 1500); } }}
                          className="bz-ref mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px]"
                          dir="ltr"
                          title={t('co.doneCopy')}
                        >
                          {copiedRef === o.reference ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
                          {copiedRef === o.reference ? t('common.copied') : o.reference}
                        </button>
                      </div>
                      <span className={BADGE[o.status] || 'bz-ob'}>
                        {t(`dashboard.ordersSection.${o.status}`)}
                      </span>
                    </div>

                    <div className="p-5 pt-4">
                      {/* ── المسارُ الزمنيّ: رأسيٌّ بتاريخِ كلِّ مرحلةٍ ووقتِها ──
                          كان أفقيّاً بأربعِ نقاطٍ وتسمياتٍ صغيرةٍ بلا تاريخٍ واحد،
                          فيعرفُ الزبونُ أين طلبُه ولا يعرفُ متى بلغَ هناك. */}
                      {cancelled ? (
                        <div className="bz-tr-cancel flex items-start gap-2.5 rounded-2xl px-4 py-3">
                          <XIcon className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="min-w-0 text-sm">
                            <p className="font-bold">{t('track.cancelledTitle')}</p>
                            {stamp(o, 'cancelled') && <p className="mt-0.5 text-xs opacity-80">{stamp(o, 'cancelled')}</p>}
                          </div>
                        </div>
                      ) : unpaid ? (
                        /* طلبٌ بدأ بالبطاقةِ ولم تكتملْ دفعتُه: مسارُ التجهيزِ لم
                           يبدأْ أصلاً، فعرضُه بأربعِ مراحلَ فارغةٍ يُوهِمُ أنّ
                           الطلبَ قائمٌ ينتظرُ المتجر — وهو ينتظرُ الدفعَ وحدَه. */
                        <div className="bz-note flex items-start gap-2.5 rounded-2xl px-4 py-3">
                          <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="min-w-0 text-sm">
                            <p className="font-bold">{t('track.unpaidTitle')}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{t('track.unpaidHint')}</p>
                          </div>
                        </div>
                      ) : (
                        <ol className="space-y-0">
                          {STEPS.map((s, i) => {
                            const done = i <= stepIdx;
                            const current = i === stepIdx;
                            const when = stamp(o, s);
                            const last = i === STEPS.length - 1;
                            return (
                              <li key={s} className="flex gap-3">
                                {/* العمودُ الرأسيّ: قرصٌ ثمّ خيطٌ يصلُه بما بعدَه */}
                                <div className="flex flex-col items-center">
                                  <span className={`bz-tl-dot ${done ? 'bz-tl-done' : ''} ${current ? 'bz-tl-now' : ''}`}>
                                    {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
                                  </span>
                                  {!last && <span className={`bz-tl-vbar ${i < stepIdx ? 'bz-tl-bar-on' : ''}`} />}
                                </div>
                                <div className={`min-w-0 flex-1 ${last ? 'pb-0' : 'pb-4'}`}>
                                  <p className={`text-sm leading-6 ${done ? 'font-bold text-[#313130] dark:text-inherit' : 'text-stone-400'}`}>
                                    {t(`dashboard.ordersSection.${s}`)}
                                  </p>
                                  {/* المنجَزُ تاريخُه، والمرحلةُ التاليةُ «قيد التنفيذ»،
                                      والتسليمُ المنتظَرُ مدّتُه المتوقّعة. وكانت
                                      «قيد التنفيذ» تُكتَبُ تحتَ المرحلةِ الحاليّةِ
                                      نفسِها، فيقرأُ صاحبُ طلبٍ مُسلَّمٍ «تم التسليم —
                                      قيد التنفيذ الآن». */}
                                  <p className="text-[11px] leading-5 text-stone-400">
                                    {done
                                      ? (when || '—')
                                      : (s === 'delivered' && eta) ? eta
                                      : (i === stepIdx + 1) ? t('track.inProgress') : '—'}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}

                      {/* ── شركةُ التوصيل: الحالةُ الحيّةُ ورقمُ الشحنةِ وتاريخُ التسليمِ لها ── */}
                      {o.courier && (
                        <div className="bz-note mt-4 space-y-1.5 px-3.5 py-3 text-xs">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <span className="flex items-center gap-1.5 font-bold">
                              <TruckIcon className="h-4 w-4 shrink-0" /> {o.courier}
                            </span>
                            {o.courierStatus && <span className="bz-ref rounded-full px-2.5 py-0.5 font-semibold">{o.courierStatus}</span>}
                            {o.tracking && (
                              <span className="text-stone-500">
                                {t('track.trackingNo')}:{' '}
                                <button
                                  type="button"
                                  onClick={async () => { if (await copyText(o.tracking)) { setCopiedTrack(o.tracking); setTimeout(() => setCopiedTrack(''), 1500); } }}
                                  dir="ltr" title={t('co.doneCopy')}
                                  className="bz-ref rounded-full px-1.5 font-mono font-semibold"
                                >
                                  {copiedTrack === o.tracking ? t('common.copied') : o.tracking}
                                </button>
                              </span>
                            )}
                          </div>
                          {o.sentAt && <p className="text-stone-500">{t('track.handedToCourier')}: {fmtDate(o.sentAt)}</p>}
                        </div>
                      )}

                      {/* ── القطع ── */}
                      <ul className="bz-hr-t mt-4 space-y-1.5 pt-3 text-sm">
                        {(o.items || []).map((it, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 flex-1 text-stone-600">
                              <span aria-hidden className="bz-bullet me-1.5 text-[8px]">◆</span>
                              {it.name}{it.color ? ` - ${it.color}` : ''}{it.size ? ` (${sizeLabel(it.size, t)})` : ''} ×{it.qty}
                            </span>
                            <span className="shrink-0 text-stone-500">{t('common.currency')}{((Number(it.price) || 0) * (Number(it.qty) || 0)).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>

                      {/* ── الحساب: تفصيلٌ لا رقمٌ واحد ── */}
                      <div className="bz-hr-t mt-3 space-y-1 pt-3 text-sm">
                        <div className="flex justify-between text-stone-500"><span>{t('receipt.subtotal')}</span><span>{t('common.currency')}{subtotal.toFixed(2)}</span></div>
                        {o.discount > 0 && (
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-300">
                            <span>{t('receipt.discount')}{o.couponCode ? ` (${o.couponCode})` : ''}</span>
                            <span>−{t('common.currency')}{Number(o.discount).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-stone-500">
                          <span>{t('receipt.delivery')}</span>
                          <span>{o.deliveryFee > 0 ? `${t('common.currency')}${Number(o.deliveryFee).toFixed(2)}` : t('receipt.freeDelivery')}</span>
                        </div>
                        <div className="bz-hr-t flex items-center justify-between pt-2 font-bold">
                          <span className="text-[#313130] dark:text-inherit">{t('receipt.total')}</span>
                          <span className="bz-total text-lg">{t('common.currency')}{o.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* ── ماذا دُفِعَ وماذا بقي: طلبُ البطاقةِ سُدِّدت بضاعتُه
                             والتوصيلُ يُدفَعُ للمندوب، فلا يُفاجَأُ أحدٌ عند الباب ── */}
                      <div className={`mt-3 rounded-2xl px-3.5 py-3 text-xs ${prepaid ? 'bz-tr-paid' : 'bz-note'}`}>
                        {prepaid ? (
                          <>
                            <p className="flex items-center gap-1.5 font-bold">
                              <CheckIcon className="h-4 w-4 shrink-0" /> {t('receipt.paidLine')} · {t('common.currency')}{Number(o.paidOnline).toFixed(2)}
                            </p>
                            {o.codDue > 0 && (
                              <p className="mt-1 flex items-start gap-1.5 leading-relaxed">
                                <TruckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                {t('checkout.dueCourier', { amount: `${t('common.currency')}${Number(o.codDue).toFixed(2)}` })}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="flex items-start gap-1.5 leading-relaxed font-semibold">
                            <CashIcon className="mt-0.5 h-4 w-4 shrink-0" />
                            {t('track.dueOnDelivery', { amount: `${t('common.currency')}${Number(o.codDue).toFixed(2)}` })}
                          </p>
                        )}
                      </div>

                      {/* ── العنوانُ وتاريخُ الطلب ── */}
                      <div className="mt-3 space-y-1 text-[11px] leading-5 text-stone-400">
                        <p className="flex items-start gap-1.5">
                          <PinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {[o.city, o.area && o.area !== o.city ? o.area : '', o.address].filter(Boolean).join(' · ')}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <ClockIcon className="h-3.5 w-3.5 shrink-0" /> {fmtDate(o.createdAt)}
                        </p>
                      </div>

                      {/* ── الأفعال: شهادةُ الشراءِ، ومراسلةُ المتجر، وإعادةُ الطلب ── */}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => takeReceipt(o, 'image')}
                          disabled={Boolean(busyReceipt)}
                          className="bz-act-2 w-full !px-3 !text-xs"
                        >
                          <DownloadIcon className="h-4 w-4 shrink-0" />
                          {busyReceipt === `${o.reference}:image` ? t('common.loading') : t('receipt.saveImage')}
                        </button>
                        <button
                          onClick={() => takeReceipt(o, 'print')}
                          disabled={Boolean(busyReceipt)}
                          className="bz-act-2 w-full !px-3 !text-xs"
                        >
                          <PrintIcon className="h-4 w-4 shrink-0" /> {t('receipt.print')}
                        </button>
                        {o.storeWhatsapp && (
                          <a
                            href={buildWhatsappLink(o.storeWhatsapp, t('track.askMsg', { ref: o.reference }))}
                            target="_blank" rel="noopener noreferrer"
                            className="btn-whatsapp col-span-2 w-full !rounded-full !py-2.5 !text-xs"
                          >
                            <WhatsAppIcon className="h-4 w-4 shrink-0" /> {t('track.askStore')}
                          </a>
                        )}
                        {/* إعادة الطلب بضغطة — نفس القطع بالمقاسات والألوان (بأسعار اليوم) */}
                        <button
                          onClick={() => reorder(o)}
                          disabled={Boolean(reordering)}
                          className="bz-act col-span-2 w-full"
                        >
                          <CartIcon className="h-4 w-4 shrink-0" /> {reordering === o.reference ? t('common.loading') : t('track.reorder')}
                        </button>
                      </div>
                    </div>
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
