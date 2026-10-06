import { useEffect, useRef, useState, Fragment } from 'react';
import { createPortal } from 'react-dom';
import modalRoot from '../../utils/modalRoot.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import useSessionState from '../../hooks/useSessionState.js';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import OrderStatus, { StatusBadge, NEXT, ACTION } from '../../components/OrderStatus.jsx';
import * as chatCache from '../../utils/chatCache.js';
import { cldThumb, cldVideoPoster } from '../../utils/cloudinary.js';
import { buildWhatsappLink, waCandidates, phoneKey } from '../../utils/whatsapp.js';
import { getCache, setCache } from '../../utils/apiCache.js';
import { downloadXlsx } from '../../utils/xlsx.js';
import { htmlToPngBlob, safeFileName, downloadBlob } from '../../utils/htmlImage.js';
import { PAPERS, getPaper, savePaper, paperCss, honorsPageSize, paperById } from '../../utils/invoicePaper.js';
import { printSheet } from '../../utils/printSheet.js';
import { copyText } from '../../utils/links.js';
import { PinIcon, NoteIcon, TicketIcon, WhatsAppIcon, TruckIcon, BellIcon, TrashIcon, BagIcon, ReceiptIcon, SearchIcon, XIcon, DownloadIcon, CheckIcon, CopyIcon, PhoneIcon, PrintIcon, ImageIcon, ChevronDownIcon, GearIcon } from '../../components/icons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCouriers, syncCourierStatuses, courierOf, CourierSend, linkedCourier } from '../../components/couriers.jsx';
import { autoSend } from '../../utils/courierAuto.js';
import { PageHead, SectionHead } from '../../components/FormField.jsx';

const FLOW = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

// مفتاح اليوم (سنة-شهر-يوم) لفصل الطلبات اليومية، ووصف بشري له (اليوم/أمس/تاريخ)
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
const dayLabel = (d, t) => {
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return t('dashboard.ordersSection.today');
  if (diff === 1) return t('dashboard.ordersSection.yesterday');
  return new Date(d).toLocaleDateString();
};
const BADGE = {
  new: 'bg-amber-500/20 text-amber-700',
  confirmed: 'bg-gold-400/20 text-gold-200',
  shipped: 'bg-wine/10 text-wine',
  delivered: 'bg-emerald-500/20 text-emerald-200',
  cancelled: 'bg-red-500/20 text-red-200',
  paid: 'bg-emerald-500/20 text-emerald-200',
  pending: 'bg-orange-500/20 text-orange-200',
  failed: 'bg-red-500/20 text-red-200',
};

function thumbMap(list) {
  const out = {};
  for (const p of list || []) {
    const raw = p.imageUrl || p.images?.[0] || '';
    const src = raw ? cldThumb(raw, 160) : (p.videoUrl ? cldVideoPoster(p.videoUrl, 160) : '');
    if (src) out[p.id] = src;
  }
  return out;
}

// صورُ القطعِ بالسطرِ المطويّ: صورةٌ واحدة، أو اثنتانِ متراكبتان إن كانت أكثرَ من قطعة،
// أو الحرفُ الأوّلُ من اسمِ الزبونةِ إن لم تكن صورة.
function OrderThumbs({ items, thumbs, name }) {
  const pics = [...new Set((items || []).map((it) => thumbs[it.id]).filter(Boolean))].slice(0, 2);
  const count = (items || []).length;
  if (!pics.length) {
    return (
      <span className="bz-othumb grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-bold">
        {String(name || '؟').trim().charAt(0) || '؟'}
      </span>
    );
  }
  return (
    <span className="relative h-12 w-12 shrink-0">
      {pics[1] && <img src={pics[1]} alt="" loading="lazy" className="bz-othumb-img absolute -end-1 top-1 h-10 w-10 rotate-6 rounded-xl object-cover" />}
      <img src={pics[0]} alt="" loading="lazy" className="bz-othumb-img absolute inset-0 h-12 w-12 rounded-2xl object-cover" />
      {count > 1 && <span className="bz-othumb-n absolute -bottom-1 -start-1 grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-extrabold">{count}</span>}
    </span>
  );
}

export default function OrdersManager() {
  const { t } = useTranslation();
  const { store } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  // ربط شركات التوصيل (أوبتيموس/EPS/gobox): حالة الربط + المدن/الأنواع مرّة واحدة للصفحة
  const couriers = useCouriers();
  // الشركةُ المربوطةُ بالمتجر: معها لا تُحرَّكُ الحالةُ باليد بعدَ التأكيد — الإرسالُ لها
  // هو الخطوةُ التالية، والشحنُ والتسليمُ يأتيان من عندِها (المزامنةُ والـwebhook)
  const linked = linkedCourier(couriers);
  // «ابعتي لـ…» من الصفِّ المطويّ: تُفتَحُ البطاقةُ ويبدأُ الإرسالُ وحدَه
  const [autoSendId, setAutoSendId] = useState('');
  const [bulkSheet, setBulkSheet] = useState(false);
  const [askBulkCancel, setAskBulkCancel] = useState(false);
  // طلبات لم تكتمل (سلات متروكة ببيانات تواصل) — لمتابعتها برسالة وإنقاذ البيع
  const [abandoned, setAbandoned] = useState([]);

  // ═════════ رقمُ واتساب الزبونِ الحقيقيّ ═════════
  // أرقامُ 059/056 قد تكونُ على واتساب بمقدّمة ‎+970 أو ‎+972 ولا يقولُ الرقمُ أيُّهما.
  // نفتحُ الأرجحَ ونسألُ «انفتحت المحادثة؟»؛ «لا» تفتحُ الأخرى، و«آه» تحفظُ الرقمَ
  // للزبونِ عند الخادم — فكلُّ طلبٍ له بعدها يُفتَحُ بالرقمِ الصحيحِ بلا سؤال.
  const [waBook, setWaBook] = useState({});
  // ملفُّ كلِّ زبونة (كم طلبت وكم صرفت) بمفتاحِ رقمِها — من الخادم مع القائمة
  const [customers, setCustomers] = useState({});
  const [waAsk, setWaAsk] = useState(null); // { id, nums, idx }
  const waOf = (phone) => {
    if (!phone) return { nums: [], sure: true, saved: false };
    const known = waBook[phoneKey(phone)];
    if (known) return { nums: [known], sure: true, saved: true };
    const nums = waCandidates(phone);
    return { nums, sure: nums.length < 2, saved: false };
  };
  const askWa = (o, info) => {
    if (info.sure) return;
    setWaAsk({ id: o.id, nums: info.nums, idx: 0 });
  };
  // سؤالُ «انفتحت محادثة الزبون؟» — نفسُه للطلبِ وللسلّةِ المتروكة
  const waAskCard = (phone) => (
    <div className="bz-waask rounded-xl p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-bold">
        <WhatsAppIcon className="h-4 w-4 shrink-0 text-[#1da851]" />
        {t('dashboard.ordersSection.waAskTitle')}
        <span dir="ltr" className="bz-waask-num ms-auto rounded-md px-1.5 py-0.5 text-[11px] font-semibold">+{waAsk.nums[waAsk.idx]}</span>
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button onClick={() => confirmWa(phone, waAsk.nums[waAsk.idx])} className="bz-waask-yes min-h-[40px] rounded-lg px-2 text-xs font-bold">
          {t('dashboard.ordersSection.waAskYes')}
        </button>
        {waAsk.idx + 1 < waAsk.nums.length ? (
          <a
            href={`https://wa.me/${waAsk.nums[waAsk.idx + 1]}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setWaAsk((a) => ({ ...a, idx: a.idx + 1 }))}
            className="bz-waask-no flex min-h-[40px] items-center justify-center rounded-lg px-2 text-center text-xs font-bold"
          >
            {t('dashboard.ordersSection.waAskTry', { code: `\u2066+${waAsk.nums[waAsk.idx + 1].slice(0, 3)}\u2069` })}
          </a>
        ) : (
          <button onClick={() => setWaAsk(null)} className="bz-waask-no min-h-[40px] rounded-lg px-2 text-xs font-bold">
            {t('dashboard.ordersSection.waAskNone')}
          </button>
        )}
      </div>
    </div>
  );

  const confirmWa = async (phone, wa) => {
    const key = phoneKey(phone);
    if (!key) return;
    const before = waBook;
    setWaBook((b) => ({ ...b, [key]: wa }));
    setWaAsk(null);
    try {
      await api.put('/orders/whatsapp', { phone, wa });
    } catch (e) {
      setWaBook(before);
      setError(getErrorMessage(e));
    }
  };
  // فلترة وبحث بالطلبات: حالة + اسم/هاتف/رقم طلب — للوصول لأي طلب بثوانٍ
  // البطاقةُ مطويّةٌ سطراً واحداً، وتنفتحُ بضغطة. كانت كلُّ بطاقةٍ مفتوحةً بكلِّ تفاصيلِها
  // (القطع والمجاميع والمراحل وعشرةُ أزرار) فيأخذُ الطلبُ الواحدُ شاشةً ونصفاً، ويمرُّ
  // الإصبعُ على عشرِ شاشاتٍ ليرى عشرةَ طلبات. الآن يُرى أكثرُها بنظرةٍ واحدة.
  const [openIds, setOpenIds] = useState(() => new Set());
  const toggleOpen = (id) => setOpenIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); setAutoSendId((cur) => (cur === id ? '' : cur)); } else next.add(id);
    return next;
  });
  const [toolsOpen, setToolsOpen] = useState(false);
  // وضعُ التحديد: تعليمُ عدّةِ طلباتٍ ثمّ تأكيدُها أو طباعتُها أو إرسالُها للمندوبِ دفعةً واحدة
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleSel = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };
  // صورةُ القطعةِ بالسطرِ المطويّ: من منتجاتِ المتجر (القطعةُ بالطلبِ تحملُ معرّفَها لا صورتَها)
  const [thumbs, setThumbs] = useState(() => thumbMap(chatCache.getProducts()));
  useEffect(() => {
    let on = true;
    api.get('/products').then((r) => {
      const list = r.data?.products || [];
      chatCache.setProducts(list.filter((p) => !p.hidden));
      if (on) setThumbs(thumbMap(list));
    }).catch(() => {});
    return () => { on = false; };
  }, []);
  const [statusFilter, setStatusFilter] = useSessionState('orders:status', 'all');
  const [oq, setOq] = useSessionState('orders:q', '');
  // «طلباتها» من صفحة «زبائني»: الصفحةُ حيّةٌ بالخلفيّة فلا تقرأُ ذاكرةَ الجلسةِ من جديد
  useEffect(() => {
    const on = (e) => { setOq(String(e.detail || '')); setStatusFilter('all'); };
    window.addEventListener('bz:orders-search', on);
    return () => window.removeEventListener('bz:orders-search', on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [toast, setToast] = useState(''); // رسالة خاطفة (نسخ التفاصيل)
  const [paper, setPaperState] = useState(getPaper); // مقاس ورق الطابعة (لكل جهاز)
  const choosePaper = (id) => { setPaperState(id); savePaper(id); };
  // على الآيفون/سفاري الورقة تُختار من حوار الطباعة (AirPrint) لا من الصفحة —
  // نقول هذا لصاحب المتجر بدل ما يدوّر على مقاسه بقائمة الجهاز ولا يلاقيه.
  const paperFromDevice = !honorsPageSize();

  useEffect(() => {
    let on = true;
    api.get('/orders/abandoned').then((r) => { if (on) setAbandoned(r.data.abandoned || []); }).catch(() => {});
    return () => { on = false; };
  }, []);

  const removeAbandoned = async (id) => {
    setAbandoned((prev) => prev.filter((x) => x.id !== id));
    try { await api.delete(`/orders/abandoned/${id}`); } catch { /* تجاهل */ }
  };

  // فتح فوري بلا تعليق: نعرض آخر قائمة محفوظة فوراً (خاصة أول فتحة والخادم
  // ما زال يستيقظ)، ثم يحدّثها الجلب الفعلي بالخلفية — نفس أسلوب صفحة المتجر
  useEffect(() => {
    if (store?.id) {
      const cached = getCache(`myorders:${store.id}`);
      if (cached) setOrders((prev) => prev ?? cached);
    }
  }, [store?.id]);

  useEffect(() => {
    let on = true;
    api.get('/orders/mine').then(async (r) => {
      if (!on) return;
      const list = r.data.orders;
      setOrders(list);
      setWaBook(r.data.waBook || {});
      setCustomers(r.data.customers || {});
      if (store?.id) setCache(`myorders:${store.id}`, list);
      // مزامنة حالة الشحنات المُرسلة (أوبتيموس/EPS/gobox) مع حالتها الحيّة هناك
      const patch = await syncCourierStatuses(list);
      if (on && patch) {
        setOrders((prev) => prev.map((o) => (patch[o.id] ? { ...o, ...patch[o.id] } : o)));
        // المزامنةُ تُحدّثُ حالةَ الطلبِ نفسَها بالخادم (وصلَ → «تم التسليم»، رجعَ → «ملغى»)،
        // لكنّ الشاشةَ كانت تعرضُ حالةَ ما قبلَها حتى إعادةِ فتحِ الصفحة. فإن تغيّرت حالةُ
        // شحنةٍ نُعيدُ قراءةَ القائمةِ مرّةً واحدة.
        const changed = list.some((o) => patch[o.id] && Object.entries(patch[o.id]).some(([k, v]) => o[k] !== v));
        if (changed) {
          const r2 = await api.get('/orders/mine').catch(() => null);
          if (on && r2) setOrders(r2.data.orders);
        }
      }
    }).catch((e) => on && setError(getErrorMessage(e)));
    return () => { on = false; };
  }, []);

  // إشارة عامة: تغيّرت حالة طلب → تُحدّث شارة "الطلبات الجديدة" فوراً بكل الموقع
  // (الشريط السفلي/القائمة) بدل انتظار الاستطلاع الدوري كل 60 ثانية = لا تعليق.
  const pingOrdersChanged = () => { try { window.dispatchEvent(new Event('bz:orders-changed')); } catch { /* ignore */ } };

  // بعد إرسال طلب لشركة توصيل: نحفظ رقم التتبّع ونحوّل الحالة لـ"تم الشحن" محلياً (مُقفلة)
  const markSent = (id, tracking, courier) => {
    const field = courier === 'eps' ? 'epsTracking' : courier === 'gobox' ? 'goboxTracking' : 'opostTracking';
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: tracking || '✓', status: 'shipped' } : o)));
    pingOrdersChanged();
  };

  // شريطُ «تراجع» بعد كلِّ تغييرٍ للحالة: ضغطةٌ خاطئةٌ على مرحلةٍ أو زرٍّ تُصحَّحُ
  // بضغطةٍ أخرى بدل البحثِ عن الطلبِ وإرجاعِه يدويّاً. الخادمُ يُرجعُ المخزونَ والكوبونَ
  // مع الحالة، فالتراجعُ تراجعٌ كامل.
  const [undo, setUndo] = useState(null); // { id, prev, next, name }
  const undoTimer = useRef(0);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const setStatus = async (id, status, { silent = false } = {}) => {
    const before = (orders || []).find((o) => o.id === id);
    const prev = before?.status;
    if (!before || prev === status) return;
    setSavingId(id);
    setError('');
    // تفاؤلي — ومعه وقتُ بلوغِ المرحلةِ فيظهرُ تحتَها فوراً كما سيحفظُه الخادم
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, status, statusAt: { ...(o.statusAt || {}), [status]: new Date().toISOString() } } : o)));
    try {
      await api.patch(`/orders/${id}/status`, { status });
      pingOrdersChanged(); // الشارة تنقص فوراً عند التأكيد/الشحن
      if (navigator.vibrate) navigator.vibrate(12);
      clearTimeout(undoTimer.current);
      if (silent) {
        setUndo(null);
      } else {
        setUndo({ id, prev, next: status, name: before.customerName || orderNo(before) });
        undoTimer.current = setTimeout(() => setUndo(null), 6000);
      }
    } catch (e) {
      // كان الفشلُ يتركُ الحالةَ الجديدةَ على الشاشةِ والقديمةَ في القاعدة: نُرجعُها
      setOrders((list) => list.map((o) => (o.id === id ? { ...o, status: prev } : o)));
      setError(getErrorMessage(e));
    } finally {
      setSavingId('');
    }
  };

  // إرسال الطلب عبر واتساب برسالة جاهزة — لشركة التوصيل إن حُدّدت، وإلا لواتساب صاحب المتجر
  const deliveryText = (o) => {
    const cur = t('common.currency');
    const items = (o.items || []).map((it) => `• ${it.name}${it.size ? ` (${it.size})` : ''}${it.color ? ` - ${it.color}` : ''} ×${it.qty}`).join('\n');
    const msg = [
      `🚚 طلب توصيل — ${store.name || ''}`,
      `الزبونة: ${o.customerName || ''}`,
      `الهاتف: ${o.customerPhone || ''}`,
      o.city ? `المدينة: ${o.city}` : '',
      o.area ? `القرية/المنطقة: ${o.area}` : '',
      o.address ? `العنوان: ${o.address}` : '',
      '',
      items,
      '',
      `الإجمالي: ${cur}${Number(o.total).toFixed(2)} (الدفع عند الاستلام)`,
      o.notes ? `ملاحظات: ${o.notes}` : '',
    ].filter(Boolean).join('\n');
    return msg;
  };
  const sendToDelivery = (o) => {
    const num = store?.deliveryPhone || store?.whatsapp;
    if (!num) return;
    window.open(buildWhatsappLink(num, deliveryText(o)), '_blank');
  };

  // ═══ الإجراءاتُ الجماعيّة ═══
  const selectedOrders = () => (orders || []).filter((o) => selected.has(o.id));
  const bulkConfirm = async () => {
    const list = selectedOrders().filter((o) => o.status === 'new' && !courierOf(o));
    if (!list.length) return;
    setBulkBusy(true);
    // واحداً واحداً لا معاً: كلُّ تأكيدٍ يخصمُ مخزوناً، والخادمُ يحسبُه بالتتابع
    for (const o of list) await setStatus(o.id, 'confirmed', { silent: true });
    setBulkBusy(false);
    setToast(t('dashboard.ordersSection.bulkConfirmed', { count: list.length }));
    setTimeout(() => setToast(''), 2500);
    exitSelect();
  };
  const bulkPrint = () => {
    const list = selectedOrders();
    if (list.length) printHtml(list.map(invoiceBody).join(''), t('dashboard.ordersSection.invoice'));
  };
  // رسالةٌ واحدةٌ للمندوبِ بكلِّ الطلباتِ المحدَّدة، مفصولةً بخطّ — بدل فتحِ واتساب لكلِّ طلب
  const bulkDelivery = () => {
    const num = store?.deliveryPhone || store?.whatsapp;
    const list = selectedOrders();
    if (!num || !list.length) return;
    const msg = list.map((o, i) => `(${i + 1}/${list.length})\n${deliveryText(o)}`).join('\n\n━━━━━━━━━━\n\n');
    window.open(buildWhatsappLink(num, msg), '_blank');
  };
  const flash = (msg, ms = 3200) => { setToast(msg); setTimeout(() => setToast(''), ms); };
  // من المحدَّد: ما ينتظرُ الإرسالَ لشركةِ التوصيلِ المربوطة، وما يُلغى، وما يُؤكَّد
  const sendable = (list) => (linked ? list.filter((o) => !courierOf(o) && (o.status === 'new' || o.status === 'confirmed')) : []);
  const cancellable = (list) => list.filter((o) => !courierOf(o) && o.status !== 'cancelled' && o.status !== 'delivered');
  // إرسالٌ جماعيٌّ للشركةِ المربوطة بالمطابقةِ نفسِها التي يستعملُها زرُّ الطلبِ الواحد
  // (utils/courierAuto.js). ما تأكّدت مدينتُه/قريتُه يُرسَلُ فوراً، وما يحتاجُ اختياراً
  // يدويّاً يبقى محدَّداً لتفتحيه — لا شحنةَ تُرسَلُ لقريةٍ مخمَّنة.
  const bulkSend = async () => {
    const list = sendable(selectedOrders());
    if (!list.length || !linked) return;
    setBulkBusy(true);
    let sent = 0;
    const manual = [];
    for (const o of list) {
      const r = await autoSend(linked.key, o, couriers);
      if (r.ok) { sent += 1; markSent(o.id, r.tracking, linked.key); } else manual.push(o.id);
    }
    setBulkBusy(false);
    setBulkSheet(false);
    const parts = [];
    if (sent) parts.push(t('dashboard.ordersSection.bulkSent', { count: sent, name: linked.name }));
    if (manual.length) parts.push(t('dashboard.ordersSection.bulkManual', { count: manual.length }));
    flash(parts.join(' · '), 5000);
    if (manual.length) { setSelected(new Set(manual)); setOpenIds((prev) => new Set([...prev, ...manual])); } else exitSelect();
  };
  const bulkCancel = async () => {
    const list = cancellable(selectedOrders());
    setAskBulkCancel(false);
    if (!list.length) return;
    setBulkBusy(true);
    for (const o of list) await setStatus(o.id, 'cancelled', { silent: true });
    setBulkBusy(false);
    setBulkSheet(false);
    flash(t('dashboard.ordersSection.bulkCancelled', { count: list.length }));
    exitSelect();
  };
  const bulkCopy = async () => {
    const list = selectedOrders();
    if (!list.length) return;
    const ok = await copyText(list.map(orderText).join('\n\n━━━━━━━━━━\n\n'));
    setBulkSheet(false);
    flash(ok ? t('common.copied') : t('common.copyFailed'), 1800);
  };

  // رسالة جاهزة للزبون عن حالة طلبه الحالية (مع شركة التوصيل ورقم التتبّع إن وُجدا)
  const orderStatusMsg = (o) => {
    const st = FLOW.includes(o.status) ? o.status : 'new';
    const c = courierOf(o);
    const courier = c?.name || '';
    const tracking = c?.tracking || '';
    const lines = [
      t('dashboard.ordersSection.waStatus.greet', { name: o.customerName || '', store: store?.name || '' }),
      t(`dashboard.ordersSection.waStatus.${st}`),
    ];
    if (courier && tracking && tracking !== '✓' && (st === 'shipped' || st === 'delivered')) {
      lines.push(t('dashboard.ordersSection.waStatus.trackingLine', { courier, tracking }));
    }
    lines.push(t('dashboard.ordersSection.waStatus.totalLine', { total: Number(o.total || 0).toFixed(2) }));
    lines.push(t('dashboard.ordersSection.waStatus.thanks'));
    return lines.join('\n');
  };

  // رقم الطلب المعروض: المرجع القصير (BZ-…) الذي يعرفه الزبون. وإن غاب (طلبات
  // قديمة) نعرض آخر ٦ خانات من المعرّف بدل UUID كامل يملأ السطر.
  const orderNo = (o) => o.reference || `#${String(o.id).replace(/-/g, '').slice(-6).toUpperCase()}`;

  // سطرُ الدفعِ بصيغتَيه — يُكتَبُ مرّةً ويُقرأُ بالفاتورةِ وبالنصِّ المنسوخِ معاً.
  // كان ثابتاً على «الدفع عند الاستلام» لكلِّ طلبٍ ولو سُدِّد بالبطاقة، فيقرأُه
  // المندوبُ ويطلبُ مبلغاً مدفوعاً. والمبلغُ مكتوبٌ صراحةً بحالةِ التحصيلِ كي لا
  // يجتهدَ أحدٌ بقراءةِ جدولِ الفاتورة.
  // ما يُحصَّلُ عند الباب: بالبطاقةِ رسومُ التوصيلِ وحدَها (البضاعةُ مدفوعة)،
  // وبالاستلامِ الإجماليُّ كلُّه. نفسُ قاعدةِ الخادمِ التي تُرسَلُ لشركةِ التوصيل.
  const dueAtDoor = (o) => (o.paymentMethod === 'card' ? Number(o.deliveryFee || 0) : Number(o.total || 0));
  const payLine = (o) => {
    const money = `${t('common.currency')}${dueAtDoor(o).toFixed(2)}`;
    if (o.paymentMethod !== 'card') return t('dashboard.ordersSection.payLineCod', { amount: money });
    // توصيلٌ مجانيٌّ بطلبِ بطاقة: لا شيءَ يُحصَّلُ أصلاً
    return dueAtDoor(o) > 0
      ? t('dashboard.ordersSection.payLineCard', { amount: money })
      : t('dashboard.ordersSection.payLineCardFree');
  };

  // نصّ الطلب كاملاً للنسخ — يُلصق بأي مكان (دفتر، محادثة، ملاحظة)
  const orderText = (o) => {
    const cur = t('common.currency');
    return [
      `${orderNo(o)} — ${t(`dashboard.ordersSection.${o.status}`)}`,
      `${o.customerName || ''} ${o.customerPhone || ''}`.trim(),
      [o.city, o.area && o.area !== o.city ? o.area : '', o.address].filter(Boolean).join(' - '),
      '',
      ...(o.items || []).map((it) => `• ${it.name}${it.size ? ` (${it.size})` : ''}${it.color ? ` - ${it.color}` : ''} ×${it.qty} = ${cur}${(it.price * it.qty).toFixed(2)}`),
      '',
      `${t('dashboard.ordersSection.delivery')}: ${cur}${Number(o.deliveryFee || 0).toFixed(2)}`,
      o.discount > 0 ? `${o.couponCode || ''}: −${cur}${Number(o.discount).toFixed(2)}` : '',
      `${t('dashboard.ordersSection.total')}: ${cur}${Number(o.total).toFixed(2)}`,
      // النصُّ المنسوخُ يُلصَقُ بمحادثةِ المندوبِ غالباً — فطريقةُ الدفعِ جزءٌ منه
      payLine(o),
      o.notes ? `${t('dashboard.ordersSection.notes')}: ${o.notes}` : '',
    ].filter(Boolean).join('\n');
  };

  // النسخُ بالناسخِ المشترَكِ لا بـ‎navigator.clipboard وحدَه: ذاك يرفضُ داخلَ
  // متصفّحاتِ التطبيقاتِ ‎(إنستغرام وفيسبوك) وعلى سفاري في حالاتٍ شتّى — والتاجرةُ
  // تفتحُ لوحتَها من رابطٍ بإنستغرام كثيراً. والمشترَكُ له مخرجٌ احتياطيٌّ قديم.
  // وكان الخطأُ يُبلَعُ بصمتٍ تامّ: تضغطُ «نسخ» فلا يحدثُ شيءٌ ولا تعرفُ أنجحَ
  // أم فشل، فتلصقُ ما نسختْه قبلَ ساعةٍ وترسلُه للزبونة.
  const copyOrder = async (o) => {
    const ok = await copyText(orderText(o));
    if (ok) {
      setToast(t('common.copied'));
      setTimeout(() => setToast(''), 1600);
    } else {
      setError(t('common.copyFailed'));
      setTimeout(() => setError(''), 3000);
    }
  };

  const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // جسم فاتورة واحدة — مفصّلة: بيانات المتجر والزبونة، وجدول بسعر الوحدة والكمية
  // والمجموع لكل قطعة، والمقاس واللون بعمودين مستقلّين، وطريقة الدفع وحالة الطلب.
  const invoiceBody = (o) => {
    const cur = t('common.currency');
    const e = escHtml;
    const c = courierOf(o);
    const rows = (o.items || []).map((it, i) => `<tr>
      <td class="n">${i + 1}</td>
      <td>${e(it.name)}</td>
      <td class="c">${e(it.size || '—')}</td>
      <td class="c">${e(it.color || '—')}</td>
      <td class="e u">${cur}${Number(it.price || 0).toFixed(2)}</td>
      <td class="c">${e(it.qty)}</td>
      <td class="e b">${cur}${((it.price || 0) * (it.qty || 0)).toFixed(2)}</td>
    </tr>`).join('');
    const line = (lbl, val, cls = '') => `<tr class="${cls}"><td colspan="6" class="e lbl">${e(lbl)}</td><td class="e">${e(val)}</td></tr>`;
    const pieces = (o.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
    return `
      <div class="inv">
        <div class="head">
          <div>
            <h1>${e(store?.name || 'Bazara')}</h1>
            <div class="muted">
              ${store?.whatsapp ? `${e(t('dashboard.store.whatsapp'))}: <span dir="ltr">${e(store.whatsapp)}</span><br>` : ''}
              ${store?.phone ? `${e(t('dashboard.store.phone'))}: <span dir="ltr">${e(store.phone)}</span><br>` : ''}
              ${store?.slug ? `bazarastore.site/store/${e(store.slug)}` : ''}
            </div>
          </div>
          <div class="inv-meta">
            <div class="tag">${e(t('dashboard.ordersSection.invoice'))}</div>
            <div class="no" dir="ltr">${e(orderNo(o))}</div>
            <div class="muted">${e(new Date(o.createdAt).toLocaleString())}</div>
            <div class="muted">${e(t('dashboard.ordersSection.status'))}: <b>${e(t(`dashboard.ordersSection.${o.status}`))}</b></div>
          </div>
        </div>

        <div class="grid2">
          <div class="box">
            <div class="box-t">${e(t('dashboard.ordersSection.customer'))}</div>
            <b>${e(o.customerName || '—')}</b><br>
            <span dir="ltr">${e(o.customerPhone || '')}</span>
          </div>
          <div class="box">
            <div class="box-t">${e(t('dashboard.ordersSection.deliveryTo'))}</div>
            ${e([o.city, o.area && o.area !== o.city ? o.area : ''].filter(Boolean).join(' - ')) || '—'}<br>
            <small>${e(o.address || '')}</small>
            ${c?.name ? `<br><small>${e(c.name)}${c.tracking && c.tracking !== '✓' ? ` — <span dir="ltr">${e(c.tracking)}</span>` : ''}</small>` : ''}
          </div>
        </div>
        ${o.notes ? `<div class="box note"><div class="box-t">${e(t('dashboard.ordersSection.notes'))}</div>${e(o.notes)}</div>` : ''}

        <table>
          <thead><tr>
            <th class="n">#</th>
            <th>${e(t('dashboard.product.name'))}</th>
            <th class="c">${e(t('dashboard.product.size'))}</th>
            <th class="c">${e(t('dashboard.product.color'))}</th>
            <th class="e u">${e(t('dashboard.ordersSection.unitPrice'))}</th>
            <th class="c">${e(t('dashboard.product.qty'))}</th>
            <th class="e">${e(t('dashboard.ordersSection.lineTotal'))}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            ${line(`${t('dashboard.ordersSection.subtotal')} (${t('dashboard.abandoned.itemsCount', { count: pieces })})`, `${cur}${(o.total - (o.deliveryFee || 0) + (o.discount || 0)).toFixed(2)}`)}
            ${o.discount > 0 ? line(`${t('dashboard.ordersSection.discount')}${o.couponCode ? ` (${o.couponCode})` : ''}`, `−${cur}${Number(o.discount).toFixed(2)}`) : ''}
            ${line(t('dashboard.ordersSection.delivery'), `${cur}${Number(o.deliveryFee || 0).toFixed(2)}`)}
            <tr class="total"><td colspan="6" class="e">${e(t('dashboard.ordersSection.total'))}</td><td class="e">${cur}${Number(o.total).toFixed(2)}</td></tr>
          </tfoot>
        </table>

        ${/* سطرُ الدفعِ يتبعُ طريقةَ الطلبِ الحقيقيّةَ لا ثابتاً واحداً.
             كان مكتوباً «الدفع عند الاستلام» على كلِّ فاتورةٍ ولو سُدِّدت
             بالبطاقة، فيقرأُها المندوبُ ويطلبُ المبلغَ ممّن دفعَ مسبقاً.
             فاتورةُ المدفوعِ الآن خضراءُ وتقولُ صراحةً: لا تُحصّل شيئاً. */''}
        <div class="pay${o.paymentMethod === 'card' ? ' paid' : ''}">${e(payLine(o))}</div>
        <div class="thanks">${e(t('dashboard.ordersSection.invoiceThanks', { store: store?.name || '' }))}</div>
      </div>`;
  };

  // أنماط الفاتورة الأساسية — مشتركة بين الطباعة وحفظ الصورة. قياس الورقة نفسه
  // (@page والتخطيط المضغوط) يُضاف عند الطباعة حسب اختيار صاحب المتجر لطابعته.
  const INVOICE_CSS = `
    *{box-sizing:border-box}
    /* المتصفّحُ يُسقِطُ خلفيّاتِ الطباعةِ افتراضاً ‎(Background graphics مطفأةٌ
       بحوارِ كروم)، والشارةُ خلفيّتُها سوداءُ ونصُّها أبيض — فتُطبَعُ بيضاءَ على
       بياضٍ ويضيعُ رقمُ الطلبِ من الفاتورة. وسطرُ «مدفوعٌ مسبقاً» يفقدُ خضرتَه
       فيقرأُه المندوبُ كسطرٍ عاديٍّ ويطلبُ المبلغَ ممّن دفع. نطلبُ الألوانَ
       صراحةً فتُطبَعُ كما صُمِّمَت بلا أن يُغيّرَ أحدٌ إعدادَ طابعتِه. */
    html,body,.inv *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:'Tajawal','Segoe UI',Tahoma,sans-serif;color:#2b2b2b;margin:0;padding:0;background:#fff}
    .inv{padding:22px 24px;max-width:800px;margin:0 auto}
    .inv + .inv{page-break-before:always}
    h1{font-size:19px;margin:0 0 4px;color:#1F1E1D}
    .muted{color:#6b6b6b;font-size:11.5px;line-height:1.7}
    /* خيطٌ متدرّجٌ أسفلَ الترويسةِ بدل خطٍّ مصمت — يفتحُ الورقةَ بلا لون */
    .head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:12px;margin-bottom:14px;border-bottom:3px solid;border-image:linear-gradient(90deg,#BAB9B7,#999795,#73716E) 1}
    .inv-meta{text-align:end}
    .tag{display:inline-block;background:#1F1E1D;color:#FFFFFF;font-weight:800;font-size:11px;padding:2px 10px;border-radius:99px;margin-bottom:4px}
    .no{font-weight:800;font-size:14px;letter-spacing:.5px}
    .grid2{display:flex;gap:10px;margin-bottom:10px}
    .box{flex:1;border:1px solid #DCDBDA;border-radius:10px;padding:9px 11px;font-size:12.5px;line-height:1.7}
    .box-t{color:#6E6C6A;font-size:10.5px;font-weight:700;margin-bottom:2px}
    .note{margin-bottom:10px}
    table{width:100%;border-collapse:collapse;font-size:12.5px}
    th{background:linear-gradient(180deg,#EAEAE9,#DFDFDF);color:#474644;text-align:start;padding:8px;border-bottom:2px solid #999795;font-size:11.5px;font-weight:700}
    td{padding:7px 8px;border-bottom:1px solid #EAEAE9;vertical-align:middle}
    .n{width:28px;text-align:center;color:#6E6C6A}
    .c{text-align:center;width:64px}
    .e{text-align:end;width:96px}
    .b{font-weight:700}
    .lbl{color:#6b6b6b}
    .total td{font-weight:800;font-size:15px;color:#1F1E1D;border-top:2px solid #999795;background:linear-gradient(180deg,#F3F3F2,#EBEBEA)}
    small{color:#6b6b6b}
    .pay{margin-top:10px;font-size:12px;font-weight:700;color:#313130;background:#EFEFEF;border-radius:8px;padding:7px 10px}
    /* المدفوعُ مسبقاً بلونٍ مختلفٍ كي تلمحَه العينُ قبل قراءةِ السطر */
    .pay.paid{color:#1f7a4d;background:#eef7f0;border:1px solid #cfe8da}
    .thanks{margin-top:10px;text-align:center;color:#6E6C6A;font-size:11.5px}
  `;

  // الطباعة من الصفحة نفسها (printSheet) لا من إطار مخفيّ — سفاري على الآيفون
  // كان يحجب الطباعة من الإطارات المخفية برسالة «حُجبت الطباعة التلقائية».
  const printHtml = (body, title) => printSheet(body, `${INVOICE_CSS}${paperCss(paper)}`, title);

  // اسم الملف = اسم الزبونة بالضبط (PDF من حوار الطباعة، وPNG عند حفظ الصورة) —
  // فلمّا يوصلها الملف بواتساب تلاقي اسمها عليه لا "فاتورة - #1234". بلا اسم:
  // رقم الطلب حتى ما يصير الملف بلا هوية.
  const invoiceName = (o) => safeFileName(o.customerName || orderNo(o), orderNo(o));
  const printInvoice = (o) => printHtml(invoiceBody(o), invoiceName(o));

  // حفظ الفاتورة صورة PNG — أسهل للإرسال بواتساب من ملف PDF
  const saveInvoiceImage = async (o) => {
    try {
      setToast(t('dashboard.ordersSection.savingImage'));
      // الصورة تتبع مقاس الورق المختار كمان: الملصق/الرول يعطي صورة مضغوطة
      // ضيّقة (أنسب لواتساب)، والورق العادي يعطي الفاتورة الكاملة
      const p = paperById(paper);
      const blob = await htmlToPngBlob(invoiceBody(o), `${INVOICE_CSS}${paperCss(paper, { zoom: false })}`, p.narrow ? 480 : 820);
      downloadBlob(blob, `${invoiceName(o)}.png`);
      setToast(t('dashboard.ordersSection.imageSaved'));
    } catch (e) {
      setError(e.message);
      setToast('');
      return;
    }
    setTimeout(() => setToast(''), 1800);
  };
  // طباعة فواتير كل الطلبات الظاهرة دفعةً واحدة — كل فاتورة بصفحة مستقلّة
  const printAllInvoices = () => {
    if (!visibleOrders.length) return;
    printHtml(visibleOrders.map(invoiceBody).join(''), t('dashboard.ordersSection.invoice'));
  };

  // تصدير Excel حقيقي (.xlsx) بثلاث أوراق منسّقة تكبر تلقائياً مع الطلبات:
  //   ١) الطلبات — سطر لكل طلب   ٢) القطع المباعة — سطر لكل قطعة (للجرد والأكثر مبيعاً)
  //   ٣) ملخّص — عدد الطلبات ومبيعاتها لكل حالة
  // العناوين مثبّتة بتصفية تلقائية، والمبالغ أرقام حقيقية لا نصّ فتُجمَع بـExcel مباشرةً.
  // subset: الطلباتُ المحدَّدةُ فقط (من شريطِ التحديد) — وإلّا كلُّ الطلبات
  const exportExcel = (subset) => {
    const list = Array.isArray(subset) ? subset : orders;
    if (!list?.length) return;
    const o2 = (k) => t(`dashboard.ordersSection.${k}`);
    const p2 = (k) => t(`dashboard.product.${k}`);
    const dest = (o) => [o.city, o.area && o.area !== o.city ? o.area : ''].filter(Boolean).join(' - ');
    // خليّةُ الحالةِ ملوّنة: المسلَّمُ أخضرُ والملغيُّ أحمرُ وما بينهما رمادِيٌّ
    // هادئ — تُمسَحُ ثلاثُ مئةِ سطرٍ بالعينِ فيُعرَفُ مكانُ الخللِ بلا قراءة.
    const statusCell = (st) => ({
      v: o2(st),
      s: st === 'delivered' ? 15 : st === 'cancelled' ? 16 : 17,
    });

    const ordersSheet = {
      name: o2('sheetOrders'),
      columns: [
        { header: '#', width: 9, type: 'int' },
        { header: o2('date'), width: 18, type: 'datetime' },
        { header: o2('customer'), width: 22 },
        { header: o2('phone'), width: 16 },
        { header: o2('deliveryTo'), width: 18 },
        { header: o2('address'), width: 30 },
        { header: o2('items'), width: 40 },
        { header: o2('subtotal'), width: 13, type: 'money', total: true },
        { header: o2('discount'), width: 12, type: 'money', total: true },
        { header: o2('coupon'), width: 14 },
        { header: o2('delivery'), width: 12, type: 'money', total: true },
        { header: o2('total'), width: 14, type: 'money', total: true },
        { header: o2('payMethod'), width: 18 },
        { header: o2('codDue'), width: 16, type: 'money', total: true },
        { header: o2('courierName'), width: 14 },
        { header: o2('trackingNo'), width: 18 },
        { header: o2('status'), width: 14 },
      ],
      totalLabel: o2('total'),
      rows: list.map((o) => [
        o.id,
        o.createdAt,
        o.customerName || '',
        o.customerPhone || '',
        dest(o),
        o.address || '',
        (o.items || []).map((it) => `${it.name}${it.size ? ` (${it.size})` : ''}${it.color ? ` - ${it.color}` : ''} ×${it.qty}`).join(' | '),
        Number((o.total - (o.deliveryFee || 0) + (o.discount || 0)).toFixed(2)),
        Number(o.discount || 0),
        o.couponCode || '',
        Number(o.deliveryFee || 0),
        Number(o.total || 0),
        o.paymentMethod === 'card' ? o2('payCard') : o2('payCod'),
        // المستحقُّ عندَ الاستلام: صفرٌ لمن دفعَ بالبطاقةِ كاملاً — وهو ما
        // تُطابِقُه التاجرةُ مع حوالةِ شركةِ التوصيلِ آخرَ الشهر.
        Number(o.codDue != null ? o.codDue : (o.paymentMethod === 'card' ? 0 : o.total) || 0),
        courierOf(o)?.name || '',
        courierOf(o)?.tracking || '',
        statusCell(o.status),
      ]),
    };

    // ورقة القطع: سطر مستقلّ لكل قطعة بكل طلب — أساس الجرد ومعرفة الأكثر مبيعاً
    const itemRows = [];
    list.forEach((o) => (o.items || []).forEach((it) => itemRows.push([
      o.id,
      o.createdAt,
      o.customerName || '',
      it.name || '',
      it.size || '',
      it.color || '',
      Number(it.qty || 0),
      Number(it.price || 0),
      Number(((it.price || 0) * (it.qty || 0)).toFixed(2)),
      statusCell(o.status),
    ])));
    const itemsSheet = {
      name: o2('sheetItems'),
      columns: [
        { header: '#', width: 9, type: 'int' },
        { header: o2('date'), width: 14, type: 'date' },
        { header: o2('customer'), width: 20 },
        { header: p2('name'), width: 30 },
        { header: p2('size'), width: 10 },
        { header: p2('color'), width: 12 },
        { header: p2('qty'), width: 9, type: 'int', total: true },
        { header: p2('price'), width: 12, type: 'money' },
        { header: o2('total'), width: 13, type: 'money', total: true },
        { header: o2('status'), width: 14 },
      ],
      totalLabel: o2('total'),
      rows: itemRows,
    };

    // المبيعات المحتسَبة = الطلبات المؤكّدة/المشحونة/المسلّمة (كما بصفحة الإحصائيات)
    const paid = list.filter((o) => ['confirmed', 'shipped', 'delivered'].includes(o.status));
    const money = (n) => Number(Number(n || 0).toFixed(2));
    // تجميع عام: يبني جدولاً من مفتاح → مجاميع، ويُرتّب تنازلياً بالمبيعات
    const groupBy = (list, keyOf, extra = () => ({})) => {
      const m = new Map();
      list.forEach((o) => {
        const k = keyOf(o);
        if (!k) return;
        const cur2 = m.get(k) || { key: k, orders: 0, revenue: 0, ...extra(o) };
        cur2.orders += 1;
        cur2.revenue += Number(o.total || 0);
        cur2.last = o.createdAt;
        m.set(k, cur2);
      });
      return [...m.values()].sort((a, b) => b.revenue - a.revenue);
    };

    // ٣) الأكثر مبيعاً — تجميع القطع باسم المنتج (يكبر تلقائياً مع كل منتج جديد)
    const prodMap = new Map();
    paid.forEach((o) => (o.items || []).forEach((it) => {
      const k = it.name || '—';
      const cur2 = prodMap.get(k) || { name: k, qty: 0, revenue: 0, orders: new Set() };
      cur2.qty += Number(it.qty) || 0;
      cur2.revenue += (Number(it.price) || 0) * (Number(it.qty) || 0);
      cur2.orders.add(o.id);
      prodMap.set(k, cur2);
    }));
    const bestSellers = {
      name: o2('sheetBest'),
      columns: [
        { header: p2('name'), width: 34 },
        { header: p2('qty'), width: 12, type: 'int', total: true },
        { header: o2('ordersCountLabel'), width: 14, type: 'int', total: true },
        { header: t('dashboard.analytics.revenue'), width: 16, type: 'money', total: true },
      ],
      totalLabel: o2('total'),
      rows: [...prodMap.values()].sort((a, b) => b.qty - a.qty)
        .map((p) => [p.name, p.qty, p.orders.size, money(p.revenue)]),
    };

    // ٤) المبيعات اليومية — سطر لكل يوم فيه طلبات (يمتدّ تلقائياً مع الأيام)
    const dayMap = new Map();
    paid.forEach((o) => {
      const k = new Date(o.createdAt).toLocaleDateString();
      const cur2 = dayMap.get(k) || { day: k, orders: 0, pieces: 0, revenue: 0, ts: new Date(o.createdAt).getTime() };
      cur2.orders += 1;
      cur2.pieces += (o.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
      cur2.revenue += Number(o.total || 0);
      dayMap.set(k, cur2);
    });
    const dailySheet = {
      name: o2('sheetDaily'),
      columns: [
        { header: o2('date'), width: 16, type: 'date' },
        { header: o2('ordersCountLabel'), width: 14, type: 'int', total: true },
        { header: p2('qty'), width: 12, type: 'int', total: true },
        { header: t('dashboard.analytics.revenue'), width: 16, type: 'money', total: true },
      ],
      totalLabel: o2('total'),
      rows: [...dayMap.values()].sort((a, b) => a.ts - b.ts).map((d) => [d.ts, d.orders, d.pieces, money(d.revenue)]),
    };

    // ٥) الزبائن — من طلب أكثر ومن أنفق أكثر (أساس المكافآت وإعادة الاستهداف)
    const customers = groupBy(paid, (o) => (o.customerPhone || o.customerName || '').trim(), (o) => ({ name: o.customerName || '' }));
    const customersSheet = {
      name: o2('sheetCustomers'),
      columns: [
        { header: o2('customer'), width: 24 },
        { header: o2('phone'), width: 18 },
        { header: o2('ordersCountLabel'), width: 14, type: 'int', total: true },
        { header: t('dashboard.analytics.revenue'), width: 16, type: 'money', total: true },
        { header: o2('date'), width: 16, type: 'date' },
      ],
      totalLabel: o2('total'),
      rows: customers.map((c) => [c.name || c.key, c.key, c.orders, money(c.revenue), c.last]),
    };

    // ٦) المدن — أين يتركّز البيع (لتسعير التوصيل واستهداف الإعلانات)
    const cities = groupBy(paid, (o) => (o.city || '').trim());
    const citiesSheet = {
      name: o2('sheetCities'),
      columns: [
        { header: o2('deliveryTo'), width: 22 },
        { header: o2('ordersCountLabel'), width: 14, type: 'int', total: true },
        { header: t('dashboard.analytics.revenue'), width: 16, type: 'money', total: true },
      ],
      totalLabel: o2('total'),
      rows: cities.map((c) => [c.key, c.orders, money(c.revenue)]),
    };

    // ٧) الملخّص — لكل حالة عدد ومبيعات، ثم مؤشّرات عامة
    const byStatus = FLOW.map((s) => {
      const list = orders.filter((o) => o.status === s);
      return [t(`dashboard.ordersSection.${s}`), list.length, money(list.reduce((sum, o) => sum + Number(o.total || 0), 0))];
    }).filter((r) => r[1] > 0);
    const revenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);
    const allPieces = paid.reduce((s, o) => s + (o.items || []).reduce((x, it) => x + (Number(it.qty) || 0), 0), 0);
    const summarySheet = {
      name: o2('sheetSummary'),
      columns: [
        { header: o2('status'), width: 24 },
        { header: o2('ordersCountLabel'), width: 14, type: 'int' },
        { header: o2('total'), width: 16, type: 'money' },
      ],
      rows: [
        ...byStatus,
        ['', '', ''],
        [t('dashboard.analytics.revenue'), paid.length, money(revenue)],
        [t('dashboard.analytics.aov'), '', money(paid.length ? revenue / paid.length : 0)],
        [p2('qty'), '', allPieces],
        [t('dashboard.analytics.topProducts'), '', prodMap.size],
        [t('dashboard.analytics.repeatRate'), '', customers.length],
      ],
    };

    downloadXlsx(
      [ordersSheet, itemsSheet, bestSellers, dailySheet, customersSheet, citiesSheet, summarySheet],
      `bazara-orders-${new Date().toISOString().slice(0, 10)}`
    );
  };

  if (orders === null && !error) return <Spinner />;

  // عدّادات الحالات — التاجرة ترى بنظرة كم طلباً يحتاج إجراء (جديد/مؤكّد…)
  const statusCounts = (orders || []).reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});

  // الطلبات المعروضة بعد الفلترة والبحث (الاسم/الهاتف بأي صيغة/رقم الطلب)
  const term = oq.trim().toLowerCase();
  const termDigits = term.replace(/\D/g, '');
  const visibleOrders = (orders || []).filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (!term) return true;
    return (
      (o.customerName || '').toLowerCase().includes(term) ||
      (termDigits.length >= 3 && (o.customerPhone || '').replace(/\D/g, '').includes(termDigits)) ||
      (o.reference || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-5">
      <PageHead
        icon={<ReceiptIcon className="h-6 w-6" />}
        title={t('dashboard.ordersSection.title')}
        hint={t('dashboard.ordersSection.stockHint')}
      />
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}
      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
          <CheckIcon className="h-4 w-4 shrink-0" /> {toast}
        </div>
      )}

      {/* طلبات لم تكتمل: زبائن أدخلوا بياناتهم بشاشة الإتمام ولم يؤكّدوا — فرصة بيع تُنقَذ برسالة */}
      {abandoned.length > 0 && (
        <div className="dash-section glass space-y-4 !border-amber-400/25 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <SectionHead icon={<BagIcon className="h-5 w-5" />} title={t('dashboard.abandoned.title')} desc={t('dashboard.abandoned.hint')} />
            <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-400">{abandoned.length}</span>
          </div>
          <div className="space-y-2">
            {abandoned.map((a) => {
              const itemsTxt = (a.items || []).map((it) => `• ${it.name}${it.size ? ` (${it.size})` : ''}${it.color ? ` - ${it.color}` : ''} ×${it.qty}`).join('\n');
              const msg = t('dashboard.abandoned.waMsg', { name: a.name || '', store: store?.name || '', items: itemsTxt, total: Number(a.total || 0).toFixed(2) });
              const waInfo = waOf(a.phone);
              const nums = waInfo.nums;
              const pieces = (a.items || []).reduce((s, i) => s + (Number(i.qty) || 1), 0);
              return (
                <div key={a.id} className="space-y-2 rounded-2xl border border-gold-400/15 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-100">
                      {a.name || a.phone} {a.phone && <a href={`tel:${String(a.phone).replace(/\s/g, '')}`} dir="ltr" className="ms-1 text-xs font-normal text-stone-400 underline-offset-2 hover:text-gold-200 hover:underline">{a.phone}</a>}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {t('dashboard.abandoned.itemsCount', { count: pieces })}{a.city ? ` · ${a.city}` : ''} · ₪{Number(a.total || 0).toFixed(0)} · {new Date(a.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {nums[0] && (
                      <a
                        href={`https://wa.me/${nums[0]}?text=${encodeURIComponent(msg)}`}
                        target="_blank" rel="noreferrer"
                        onClick={() => askWa({ id: `ab-${a.id}` }, waInfo)}
                        className="btn-whatsapp gap-1.5 !px-3 !py-1.5 text-xs"
                      >
                        <WhatsAppIcon className="h-4 w-4" /> {t('dashboard.abandoned.nudge')}
                      </a>
                    )}
                    <button onClick={() => removeAbandoned(a.id)} aria-label={t('common.remove')} className="p-1.5 text-stone-500 transition hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                  </div>
                </div>
                {waAsk?.id === `ab-${a.id}` && waAskCard(a.phone)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ ملخّصُ اليوم: ما يهمُّ أوّلَ ما تفتحُ الصفحة ═══ */}
      {orders?.length > 0 && (() => {
        const todayKey = dayKey(new Date().toISOString());
        const today = orders.filter((o) => dayKey(o.createdAt) === todayKey);
        const todaySum = today.filter((o) => o.status !== 'cancelled').reduce((n, o) => n + (Number(o.total) || 0), 0);
        const waiting = statusCounts.new || 0;
        return (
          <div className="bz-osum grid grid-cols-3 overflow-hidden rounded-2xl">
            <div className="bz-osum-cell px-3 py-3 text-center">
              <p className="bz-osum-k text-[11px] font-semibold">{t('dashboard.ordersSection.sumToday')}</p>
              <p className="bz-osum-v mt-0.5 font-display text-xl font-extrabold tabular-nums">{today.length}</p>
            </div>
            <div className="bz-osum-cell px-3 py-3 text-center">
              <p className="bz-osum-k text-[11px] font-semibold">{t('dashboard.ordersSection.sumSales')}</p>
              <p className="bz-osum-v mt-0.5 font-display text-xl font-extrabold tabular-nums">{t('common.currency')}{Math.round(todaySum)}</p>
            </div>
            <button
              type="button"
              onClick={() => waiting && setStatusFilter('new')}
              className={`bz-osum-cell px-3 py-3 text-center ${waiting ? 'is-alert app-tap' : ''}`}
            >
              <p className="bz-osum-k text-[11px] font-semibold">{t('dashboard.ordersSection.sumWaiting')}</p>
              <p className="bz-osum-v mt-0.5 font-display text-xl font-extrabold tabular-nums">{waiting}</p>
            </button>
            <WeekBars orders={orders} />
          </div>
        );
      })()}

      {/* ═══ شريطُ البحثِ والحالات: يلتصقُ تحت الهيدر ويتبعُه حين ينزلق ═══
          الحالاتُ تبويباتٌ بأعدادِها في سطرٍ يتمرّر، والطباعةُ والتصديرُ خلفَ زرِّ «أدوات»:
          كانت كلُّها بصندوقٍ واحدٍ بطولِ الشاشة قبلَ أوّلِ طلب. */}
      {orders?.length > 1 && (
        <div className="bz-obar sticky top-[calc(var(--bz-headline-h)+var(--bz-tabbar-h,0px))] z-30 -mx-1 space-y-2 rounded-2xl px-1 py-2 transition-[top] duration-300 ease-out motion-reduce:transition-none">
          <div className="flex items-center gap-2">
            <div className="bz-osearch flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3">
              <SearchIcon className="h-4 w-4 shrink-0 text-stone-400" />
              <input
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none"
                placeholder={t('dashboard.ordersSection.searchPlaceholder')}
                value={oq}
                onChange={(e) => setOq(e.target.value)}
              />
              {oq && (
                <button type="button" onClick={() => setOq('')} aria-label={t('common.cancel')} className="shrink-0 text-stone-400 transition hover:text-gold-200">
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              aria-pressed={selectMode}
              title={t('dashboard.ordersSection.select')}
              className={`bz-osearch app-tap flex h-[42px] shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-bold ${selectMode ? 'is-on' : ''}`}
            >
              <CheckIcon className="h-4 w-4" />
              {t('dashboard.ordersSection.select')}
            </button>
            <button
              type="button"
              onClick={() => setToolsOpen((v) => !v)}
              aria-expanded={toolsOpen}
              title={t('dashboard.ordersSection.tools')}
              className={`bz-osearch app-tap grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl ${toolsOpen ? 'is-on' : ''}`}
            >
              <GearIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="bz-ochips -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist">
            {['all', ...FLOW].map((s) => {
              const n = s === 'all' ? (orders?.length || 0) : (statusCounts[s] || 0);
              if (s !== 'all' && n === 0) return null;
              const on = statusFilter === s;
              return (
                <button
                  key={s}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setStatusFilter(s)}
                  data-status={s}
                  className={`bz-ochip app-tap inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${on ? 'is-on' : ''}`}
                >
                  {s !== 'all' && <span className={`bz-ochip-dot bz-st-${s} h-1.5 w-1.5 rounded-full`} />}
                  {s === 'all' ? t('common.all') : t(`dashboard.ordersSection.${s}`)}
                  <span className="bz-ochip-n tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
          {selectMode && (
            <div className="flex items-center justify-between gap-2 px-1 text-[12px]">
              <span className="text-stone-400">{t('dashboard.ordersSection.selectHint')}</span>
              <button
                type="button"
                onClick={() => setSelected(selected.size === visibleOrders.length ? new Set() : new Set(visibleOrders.map((o) => o.id)))}
                className="shrink-0 font-bold text-gold-300 underline-offset-2 hover:underline"
              >
                {selected.size === visibleOrders.length && visibleOrders.length ? t('dashboard.ordersSection.selectNone') : t('dashboard.ordersSection.selectAll')}
              </button>
            </div>
          )}
          {toolsOpen && (
            <div className="bz-otoolsbar flex flex-wrap items-center gap-2 rounded-xl p-2">
              <span title={t('dashboard.paper.title')} className="shrink-0">
                <Select
                  value={paper}
                  onChange={choosePaper}
                  options={PAPERS.map((x) => ({ value: x.id, label: t(`dashboard.paper.${x.id}`) }))}
                  className="w-32 whitespace-nowrap"
                />
              </span>
              <button onClick={printAllInvoices} title={t('dashboard.ordersSection.printAll')} className="bz-listtool">
                <PrintIcon className="h-4 w-4 shrink-0" /> <span>{t('dashboard.ordersSection.printAll')}</span>
              </button>
              <button onClick={exportExcel} className="bz-listtool">
                <DownloadIcon className="h-4 w-4 shrink-0" /> {t('dashboard.ordersSection.export')}
              </button>
              {paperFromDevice && (
                <p className="w-full text-[11px] leading-snug text-stone-400">{t('dashboard.paper.deviceHint')}</p>
              )}
            </div>
          )}
          {(oq.trim() || statusFilter !== 'all') && visibleOrders.length > 0 && (
            <p className="px-1 text-[11px] text-stone-400">{t('dashboard.product.showing', { shown: visibleOrders.length, total: orders.length })}</p>
          )}
        </div>
      )}

      {orders && orders.length === 0 ? (
        <div className="dash-section glass p-5 sm:p-6">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gold-400/25 bg-black/15 p-8 text-center">
            <ReceiptIcon className="h-8 w-8 text-gold-300" />
            <span className="text-sm text-stone-400">{t('dashboard.ordersSection.empty')}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            if (!visibleOrders.length) {
              return (
                <div className="dash-section glass p-5 sm:p-6">
                  <p className="rounded-2xl border border-gold-400/15 bg-black/20 py-8 text-center text-sm text-stone-400">{t('dashboard.ordersSection.noResults')}</p>
                </div>
              );
            }
            // عدد الطلبات وإجمالي المبيعات لكل يوم (الملغاة لا تُحسب بالإجمالي)
            const counts = {};
            const daySums = {};
            visibleOrders.forEach((o) => {
              const k = dayKey(o.createdAt);
              counts[k] = (counts[k] || 0) + 1;
              if (o.status !== 'cancelled') daySums[k] = (daySums[k] || 0) + (Number(o.total) || 0);
            });
            let lastDay = null;
            return visibleOrders.map((o) => {
            const subtotal = (o.total - (o.deliveryFee || 0) + (o.discount || 0)).toFixed(2);
            // أرقام 059/056 قد تكون على واتساب بمقدمة 970 أو 972 — نجهّز المقدمتين:
            // الزر الرئيسي يفتح الأرجح، وبجانبه بديل صغير لو قال واتساب "غير موجود"
            const waInfo = waOf(o.customerPhone);
            const waNums = waInfo.nums;
            const cs = customers[o.customerKey];
            const picked = selected.has(o.id);
            const open = !selectMode && (openIds.has(o.id) || visibleOrders.length === 1);
            const pieces = (o.items || []).reduce((n, it) => n + (Number(it.qty) || 1), 0);
            // الخطوةُ التاليةُ على المطويّ — إلّا إن كانت شركةُ توصيلٍ تديرُ الحالة
            // تظهرُ للطلبِ الجديدِ وحدَه: هو ما ينتظرُ قراراً الآن، ومراحلُ الشحنِ والتسليمِ
            // داخلَ الطلبِ المفتوح — وإلّا عادت كلُّ بطاقةٍ ثلثَ شاشة.
            const quickNext = o.status === 'new' && !courierOf(o) ? NEXT[o.status] : null;
            // مع شركةٍ مربوطة: الزرُّ السريعُ «ابعتي لـ…» لا «أكّدي» — الإرسالُ نفسُه تأكيد
            const quickSend = linked && !courierOf(o) && (o.status === 'new' || o.status === 'confirmed');
            const k = dayKey(o.createdAt);
            const header = k !== lastDay ? (
              <div className="flex items-center gap-2 pt-2">
                <h3 className="text-sm font-bold text-gold-300">{dayLabel(o.createdAt, t)}</h3>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-stone-400">{t('dashboard.ordersSection.ordersCount', { count: counts[k] })}</span>
                {daySums[k] > 0 && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">{t('common.currency')}{daySums[k].toFixed(0)}</span>}
                <span className="h-px flex-1 bg-white/10" />
              </div>
            ) : null;
            lastDay = k;
            return (
              <Fragment key={o.id}>
              {header}
              <div className={`bz-ocard glass overflow-hidden ${open ? 'is-open' : ''} ${picked ? 'is-picked' : ''}`} data-status={o.status}>
                {/* ═══ السطرُ المطويّ: من، وكم، وأين وصل — بنظرة ═══ */}
                <button
                  type="button"
                  onClick={() => (selectMode ? toggleSel(o.id) : toggleOpen(o.id))}
                  aria-expanded={selectMode ? undefined : open}
                  aria-pressed={selectMode ? picked : undefined}
                  className="bz-orow app-tap flex w-full items-center gap-3 p-3.5 text-start"
                >
                  <OrderThumbs items={o.items} thumbs={thumbs} name={o.customerName} />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[14.5px] font-bold text-stone-100">{o.customerName || '—'}</span>
                      {cs && (
                        <span className={`bz-cust-chip ${cs.orders > 1 ? 'is-back' : 'is-new'} inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[9.5px] font-bold`}>
                          {cs.orders > 1 ? `🔁 ${cs.orders}` : '✨'}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-stone-400">
                      {[
                        t('dashboard.abandoned.itemsCount', { count: pieces }),
                        o.city,
                        new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-display text-[15.5px] font-extrabold tabular-nums text-gold-300">{t('common.currency')}{Number(o.total).toFixed(0)}</span>
                    {FLOW.includes(o.status)
                      ? <StatusBadge status={o.status} />
                      : <span className={`badge ${BADGE[o.status] || ''}`}>{t(`dashboard.ordersSection.${o.status}`)}</span>}
                  </span>
                  {selectMode ? (
                    <span className={`bz-ocheck grid h-6 w-6 shrink-0 place-items-center rounded-full ${picked ? 'is-on' : ''}`}>
                      {picked && <CheckIcon className="h-3.5 w-3.5" />}
                    </span>
                  ) : (
                    <ChevronDownIcon className={`bz-ochev h-4 w-4 shrink-0 text-stone-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {/* أزرارٌ سريعةٌ على المطويّ: الخطوةُ التاليةُ والتواصلُ بلا فتحِ الطلب —
                    الطلبُ الجديدُ يُؤكَّدُ بضغطتين. لا تظهرُ لطلبٍ انتهت رحلتُه. */}
                {!open && !selectMode && (quickNext || quickSend) && (
                  <div className="bz-oquick flex items-center gap-2 px-3.5 pb-3">
                    {quickSend ? (
                      <button
                        type="button"
                        onClick={() => { setAutoSendId(o.id); if (!open) toggleOpen(o.id); }}
                        className="bz-oquick-go bz-ost-next bz-st-shipped flex min-h-[38px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-extrabold"
                      >
                        <TruckIcon className="h-4 w-4 shrink-0" /> {t('dashboard.ordersSection.sendTo', { name: linked.name })}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStatus(o.id, quickNext)}
                        disabled={savingId === o.id}
                        className={`bz-oquick-go bz-ost-next bz-st-${quickNext} min-h-[38px] min-w-0 flex-1 rounded-xl px-3 text-[13px] font-extrabold disabled:opacity-60`}
                      >
                        {t(`dashboard.ordersSection.${ACTION[quickNext]}`)}
                      </button>
                    )}
                    {waNums.length > 0 && (
                      <a
                        href={`https://wa.me/${waNums[0]}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => askWa(o, waInfo)}
                        aria-label={t('dashboard.ordersSection.contactWhatsapp')}
                        className="bz-oquick-ico is-wa grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl"
                      >
                        <WhatsAppIcon className="h-5 w-5" />
                      </a>
                    )}
                    {o.customerPhone && (
                      <a
                        href={`tel:${o.customerPhone.replace(/\s/g, '')}`}
                        aria-label={t('dashboard.ordersSection.callShort')}
                        className="bz-oquick-ico grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl"
                      >
                        <PhoneIcon className="h-[18px] w-[18px]" />
                      </a>
                    )}
                  </div>
                )}
                {!open && waAsk?.id === o.id && <div className="px-3.5 pb-3.5">{waAskCard(o.customerPhone)}</div>}

                {open && (
                <div className="bz-obody border-t px-4 pb-4 pt-3">
                {/* التفاصيلُ كما كانت: الرقمُ والهاتفُ والتاريخُ الكاملُ والدفع، ثمّ كلُّ شيء */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-400">
                    {o.customerPhone && <a href={`tel:${o.customerPhone.replace(/\s/g, '')}`} className="underline-offset-2 transition hover:text-gold-200 hover:underline" dir="ltr">{o.customerPhone}</a>}
                    <span>{new Date(o.createdAt).toLocaleString()}</span>
                  </p>
                  <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {cs && cs.orders > 1 && (
                      <button
                        onClick={() => setOq(o.customerPhone)}
                        title={t('dashboard.ordersSection.custFilter')}
                        className="bz-cust-chip is-back inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      >
                        {t('dashboard.ordersSection.custBack', { count: cs.orders })}
                        {cs.spent > 0 && <span className="tabular-nums opacity-80">· ₪{Math.round(cs.spent)}</span>}
                      </button>
                    )}
                    {cs && cs.orders <= 1 && (
                      <span className="bz-cust-chip is-new inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold">
                        {t('dashboard.ordersSection.custNew')}
                      </span>
                    )}
                    <span className="rounded-full bg-gold-400/10 px-2 py-0.5 text-[10px] font-bold text-stone-400" dir="ltr">{orderNo(o)}</span>
                    {o.paymentMethod === 'card' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                        <CheckIcon className="h-3 w-3 shrink-0" /> {t('dashboard.ordersSection.paidBadge')}
                      </span>
                    )}
                  </span>
                </div>

                {/* القطع — صفوف مقروءة: الكمية بشارة، والتفاصيل تحت الاسم، والسعر بالطرف */}
                <div className="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl border border-gold-400/15 bg-black/20">
                  {(o.items || []).map((it, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gold-400/15 text-[11px] font-bold text-gold-200" dir="ltr">×{it.qty}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-stone-200">{it.name}</p>
                        {(it.size || it.color) && (
                          <p className="mt-0.5 truncate text-[11px] text-stone-400">
                            {[it.size && `${t('dashboard.product.size')}: ${it.size}`, it.color && `${t('dashboard.product.color')}: ${it.color}`].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-300">{t('common.currency')}{(it.price * it.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* التوصيل والملاحظات */}
                {(o.city || o.address || o.notes) && (
                  <div className="mt-2.5 space-y-1.5">
                    {(o.city || o.address) && (
                      <p className="flex items-start gap-1.5 text-[11px] text-stone-400">
                        <PinIcon className="mt-px h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="text-stone-200">{[o.city, o.area && o.area !== o.city ? o.area : ''].filter(Boolean).join(' - ')}</span>
                          {o.address ? <span className="text-stone-300"> — {o.address}</span> : null}
                        </span>
                      </p>
                    )}
                    {o.notes && <p className="flex items-start gap-1.5 text-[11px] text-stone-400"><NoteIcon className="mt-px h-3.5 w-3.5 shrink-0" /> <span className="min-w-0">{o.notes}</span></p>}
                  </div>
                )}

                {/* الملخّص المالي — سطور مرتّبة بدل صفّ مزدحم، والإجمالي بارز */}
                <div className="mt-2.5 space-y-1 rounded-2xl border border-gold-400/15 bg-black/20 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2 text-stone-400">
                    <span>{t('dashboard.ordersSection.subtotal')}</span>
                    <span className="tabular-nums">{t('common.currency')}{subtotal}</span>
                  </div>
                  {o.discount > 0 && (
                    <div className="flex items-center justify-between gap-2 text-emerald-400">
                      <span className="inline-flex items-center gap-1"><TicketIcon className="h-3.5 w-3.5" /> {o.couponCode}</span>
                      <span className="tabular-nums">−{t('common.currency')}{o.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 text-stone-400">
                    <span>{t('dashboard.ordersSection.delivery')}</span>
                    <span className="tabular-nums">{t('common.currency')}{(o.deliveryFee || 0).toFixed(2)}</span>
                  </div>
                  {/* الربح: يظهر فقط عند معرفة تكلفة كل قطعة بالطلب. «تقديري» يعني
                      أن الطلب أقدم من حقل التكلفة فحُسب بتكلفة اليوم لا بتكلفة يومها. */}
                  {o.profit != null && (
                    <div className="flex items-center justify-between gap-2 text-emerald-400">
                      <span className="inline-flex items-center gap-1">
                        {t('dashboard.ordersSection.profit')}
                        {!o.profitExact && (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-bold text-amber-400">{t('dashboard.ordersSection.estimated')}</span>
                        )}
                      </span>
                      <span className="font-bold tabular-nums">{t('common.currency')}{o.profit.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-1.5">
                    <span className="text-sm font-bold text-stone-200">{t('dashboard.ordersSection.total')}</span>
                    {/* الإجمالي يبقى الأبرز بالبطاقة بذهبه الكامل — صغّرته سابقاً بحجّة
                        توحيد المقاييس فخفت حضوره، وهو أهمّ رقم بالطلب */}
                    <span className="font-display text-lg font-extrabold tabular-nums text-gold-300">{t('common.currency')}{o.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* حالةُ الطلب: شريطُ المراحلِ وزرُّ الخطوةِ التالية والإلغاءُ بتأكيد */}
                <OrderStatus
                  status={o.status}
                  saving={savingId === o.id}
                  onChange={(st) => setStatus(o.id, st)}
                  statusAt={o.statusAt}
                  createdAt={o.createdAt}
                  locked={courierOf(o)
                    ? `${courierOf(o).label || t(`dashboard.ordersSection.${FLOW.includes(o.status) ? o.status : 'shipped'}`)} · ${t(`dashboard.${courierOf(o).key}.managed`)}`
                    : null}
                  auto={linked && !courierOf(o) && (o.status === 'new' || o.status === 'confirmed') ? {
                    name: linked.name,
                    action: <CourierSend order={o} couriers={couriers} onSent={markSent} big autoStart={autoSendId === o.id} />,
                  } : null}
                />

                {/* ═══ التواصلُ والأدوات ═══
                    كانت ثلاثةَ صفوفٍ ملتفّةٍ بأحجامٍ وألوانٍ مختلفة: زرّا واتساب (‎+970 و‎+972)
                    وأبلغ وأرسل وشركاتُ التوصيل وأربعُ أدوات — تتكسّرُ بحسبِ عرضِ الشاشة. صارت
                    طبقاتٍ ثابتة: التواصلُ المباشرُ أوّلاً وأكبر، ثمّ الرسائلُ الجاهزة، ثمّ
                    شركاتُ التوصيل، ثمّ أدواتُ الورقِ شريطاً واحداً مقسوماً. */}
                <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                  {(waNums.length > 0 || o.customerPhone) && (
                    <div className="flex gap-2">
                      {waNums.length > 0 && (
                        <a
                          href={`https://wa.me/${waNums[0]}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => askWa(o, waInfo)}
                          className="btn-whatsapp min-h-[44px] min-w-0 flex-1 gap-2 !rounded-xl !px-3 !py-2 text-sm"
                        >
                          <WhatsAppIcon className="h-5 w-5 shrink-0" />
                          <span className="truncate">{t('dashboard.ordersSection.contactWhatsapp')}</span>
                          {waInfo.sure && waInfo.saved && <CheckIcon className="h-4 w-4 shrink-0 opacity-90" />}
                        </a>
                      )}
                      {o.customerPhone && (
                        <a
                          href={`tel:${o.customerPhone.replace(/\s/g, '')}`}
                          className="bz-oact min-h-[44px] shrink-0 gap-1.5 px-4 text-sm"
                        >
                          <PhoneIcon className="h-[18px] w-[18px]" /> {t('dashboard.ordersSection.callShort')}
                        </a>
                      )}
                    </div>
                  )}

                  {/* «انفتحت محادثة الزبون؟» — بعد فتحِ واتساب برقمٍ لم يُؤكَّد بعد */}
                  {waAsk?.id === o.id && waAskCard(o.customerPhone)}

                  {/* رسائلُ جاهزة: حالةُ الطلبِ للزبون، وتفاصيلُه لمندوبِ التوصيل */}
                  {(waNums.length > 0 || store?.deliveryPhone || store?.whatsapp) && (
                    <div className="grid grid-cols-2 gap-2 [&>*:only-child]:col-span-2">
                      {waNums.length > 0 && (
                        <a
                          href={`https://wa.me/${waNums[0]}?text=${encodeURIComponent(orderStatusMsg(o))}`}
                          target="_blank" rel="noreferrer"
                          onClick={() => askWa(o, waInfo)}
                          className="bz-oact min-h-[40px] min-w-0 gap-1.5 px-2 text-xs"
                        >
                          <BellIcon className="h-4 w-4 shrink-0" /> <span className="truncate">{t('dashboard.ordersSection.notifyCustomer')}</span>
                        </a>
                      )}
                      {(store?.deliveryPhone || store?.whatsapp) && (
                        <button onClick={() => sendToDelivery(o)} className="bz-oact min-h-[40px] min-w-0 gap-1.5 px-2 text-xs">
                          <TruckIcon className="h-4 w-4 shrink-0" /> <span className="truncate">{t('dashboard.ordersSection.sendDelivery')}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* شركاتُ التوصيلِ المربوطة — أزرارُها ونماذجُها كما هي، بسطرٍ خاصٍّ بها */}
                  {/* أُرسلَ لشركة: رقمُ التتبّعِ والبوليصة. وقبلَ الإرسالِ زرُّه بشريطِ الحالةِ أعلاه */}
                  {(courierOf(o) || !linked) && (
                    <div className="flex flex-wrap items-center gap-2 empty:hidden">
                      <CourierSend order={o} couriers={couriers} onSent={markSent} />
                    </div>
                  )}

                  {/* أدواتُ الورق: شريطٌ واحدٌ مقسومٌ بالتساوي على أيِّ عرض */}
                  <div className="bz-otools grid grid-cols-3 overflow-hidden rounded-xl">
                    <button onClick={() => copyOrder(o)} title={t('dashboard.ordersSection.copyOrder')} className="bz-otool">
                      <CopyIcon className="h-[17px] w-[17px] shrink-0" /> <span>{t('dashboard.ordersSection.copyShort')}</span>
                    </button>
                    <button onClick={() => saveInvoiceImage(o)} title={t('dashboard.ordersSection.saveImage')} className="bz-otool">
                      <ImageIcon className="h-[17px] w-[17px] shrink-0" /> <span>{t('dashboard.ordersSection.saveImageShort')}</span>
                    </button>
                    <button onClick={() => printInvoice(o)} title={t('dashboard.ordersSection.printInvoice')} className="bz-otool">
                      <PrintIcon className="h-[17px] w-[17px] shrink-0" /> <span>{t('dashboard.ordersSection.printShort')}</span>
                    </button>
                  </div>
                </div>
                </div>
                )}
              </div>
              </Fragment>
            );
            });
          })()}
        </div>
      )}

      {/* شريطُ الإجراءاتِ الجماعيّة: يطفو فوقَ الشريطِ السفليِّ ما دام هناك تحديد.
          زرٌّ رئيسيٌّ واحدٌ بحسبِ الحال (الإرسالُ للشركة، أو التأكيد، أو الطباعة)،
          و«⋯» يفتحُ كلَّ ما يُعمَلُ بالمحدَّد بقائمةٍ واضحة. */}
      {selectMode && selected.size > 0 && (() => {
        const sel = selectedOrders();
        const newCount = sel.filter((o) => o.status === 'new' && !courierOf(o)).length;
        const sendCount = sendable(sel).length;
        const primary = sendCount && linked?.key !== 'gobox'
          ? { label: t('dashboard.ordersSection.bulkSendTo', { count: sendCount, name: linked.name }), run: bulkSend, cls: 'bz-st-shipped' }
          : newCount
            ? { label: t('dashboard.ordersSection.bulkConfirm', { count: newCount }), run: bulkConfirm, cls: 'bz-st-confirmed' }
            : { label: t('dashboard.ordersSection.bulkPrint', { count: sel.length }), run: bulkPrint, cls: 'bz-st-delivered' };
        return (
          <div className="fixed inset-x-0 z-[80] flex justify-center px-3" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
            <div className="bz-bulkbar flex w-full max-w-md items-center gap-1.5 rounded-2xl p-2 shadow-2xl">
              <span className="bz-bulkbar-n shrink-0 rounded-xl px-2.5 py-2 text-[13px] font-extrabold tabular-nums">{sel.length}</span>
              <button onClick={primary.run} disabled={bulkBusy} className={`bz-ost-next ${primary.cls} min-h-[40px] min-w-0 flex-1 truncate rounded-xl px-2 text-[12.5px] font-extrabold disabled:opacity-60`}>
                {bulkBusy ? '…' : primary.label}
              </button>
              <button onClick={() => setBulkSheet(true)} aria-label={t('dashboard.ordersSection.bulkMore')} className="bz-bulkbar-btn flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl px-3 text-[12px] font-bold">
                <span className="text-lg leading-none" aria-hidden>⋯</span> {t('dashboard.ordersSection.bulkMoreShort')}
              </button>
              <button onClick={exitSelect} aria-label={t('common.cancel')} className="bz-bulkbar-btn grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })()}

      {bulkSheet && selected.size > 0 && createPortal((() => {
        const sel = selectedOrders();
        const newCount = sel.filter((o) => o.status === 'new' && !courierOf(o)).length;
        const sendCount = sendable(sel).length;
        const cancelCount = cancellable(sel).length;
        const deliveryNum = store?.deliveryPhone || store?.whatsapp;
        const rows = [
          linked && { k: 'send', Icon: TruckIcon, label: t('dashboard.ordersSection.bulkSendTo', { count: sendCount, name: linked.name }), hint: linked.key === 'gobox' ? t('dashboard.ordersSection.bulkGoboxHint') : t('dashboard.ordersSection.bulkSendHint'), run: bulkSend, off: !sendCount || linked.key === 'gobox' },
          { k: 'confirm', Icon: CheckIcon, label: t('dashboard.ordersSection.bulkConfirm', { count: newCount }), hint: t('dashboard.ordersSection.bulkConfirmHint'), run: bulkConfirm, off: !newCount },
          { k: 'print', Icon: PrintIcon, label: t('dashboard.ordersSection.bulkPrint', { count: sel.length }), hint: t('dashboard.ordersSection.bulkPrintHint'), run: () => { setBulkSheet(false); bulkPrint(); } },
          { k: 'excel', Icon: DownloadIcon, label: t('dashboard.ordersSection.bulkExcel', { count: sel.length }), hint: t('dashboard.ordersSection.bulkExcelHint'), run: () => { setBulkSheet(false); exportExcel(sel); } },
          { k: 'copy', Icon: CopyIcon, label: t('dashboard.ordersSection.bulkCopy', { count: sel.length }), hint: t('dashboard.ordersSection.bulkCopyHint'), run: bulkCopy },
          deliveryNum && { k: 'wa', Icon: WhatsAppIcon, label: t('dashboard.ordersSection.bulkCourier'), hint: t('dashboard.ordersSection.bulkWaHint'), run: () => { setBulkSheet(false); bulkDelivery(); } },
          { k: 'cancel', Icon: XIcon, label: t('dashboard.ordersSection.bulkCancel', { count: cancelCount }), hint: t('dashboard.ordersSection.bulkCancelHint'), run: () => setAskBulkCancel(true), off: !cancelCount, danger: true },
        ].filter(Boolean);
        return (
          <div className="fixed inset-0 z-[105] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={t('dashboard.ordersSection.bulkMore')}>
            <button type="button" aria-label={t('common.close', { defaultValue: 'إغلاق' })} onClick={() => setBulkSheet(false)} className="bz-sheet-backdrop absolute inset-0" />
            <div className="bz-sheet relative mx-auto flex max-h-[85%] w-full max-w-lg flex-col rounded-t-3xl pb-[max(env(safe-area-inset-bottom),14px)]">
              <span className="bz-sheet-grip mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full" aria-hidden />
              <div className="flex shrink-0 items-center gap-2 px-5 pb-2 pt-3">
                <p className="flex-1 text-[16px] font-extrabold">{t('dashboard.ordersSection.bulkTitle', { count: sel.length })}</p>
                <button onClick={() => setBulkSheet(false)} className="rounded-full p-1.5" aria-label={t('common.close', { defaultValue: 'إغلاق' })}><XIcon className="h-5 w-5" /></button>
              </div>
              <ul className="min-h-0 space-y-1.5 overflow-y-auto overscroll-contain px-4 pb-2">
                {rows.map((r) => (
                  <li key={r.k}>
                    <button type="button" onClick={r.run} disabled={r.off || bulkBusy}
                      className={`bz-sheet-item flex w-full items-center gap-3 rounded-2xl p-3 text-start transition disabled:opacity-40 ${r.danger ? 'is-danger' : ''}`}>
                      <span className={`bz-bulk-ico grid h-10 w-10 shrink-0 place-items-center rounded-xl ${r.danger ? 'is-danger' : ''}`}><r.Icon className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-extrabold">{r.label}</span>
                        <span className="bz-sheet-muted block text-[11.5px] leading-snug">{r.hint}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })(), modalRoot())}

      <ConfirmModal
        open={askBulkCancel}
        title={t('dashboard.ordersSection.cancelTitle')}
        message={t('dashboard.ordersSection.bulkCancelMsg', { count: cancellable(selectedOrders()).length })}
        confirmLabel={t('dashboard.ordersSection.cancelYes')}
        cancelLabel={t('dashboard.ordersSection.keepOrder')}
        onConfirm={bulkCancel}
        onCancel={() => setAskBulkCancel(false)}
      />

      {/* «تراجع»: يطفو فوقَ الشريطِ السفليِّ ستَّ ثوانٍ بعد كلِّ تغييرٍ للحالة */}
      {undo && (
        <div className="bz-undo fixed inset-x-0 z-[80] flex justify-center px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
          <div className="bz-undo-card flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl">
            <StatusBadge status={undo.next} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{undo.name}</span>
            <button
              onClick={() => { const u = undo; setUndo(null); clearTimeout(undoTimer.current); setStatus(u.id, u.prev, { silent: true }); }}
              className="bz-undo-btn shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-extrabold"
            >
              {t('dashboard.ordersSection.undo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════ مبيعاتُ آخرِ ٧ أيّام: سبعةُ أعمدةٍ تحت ملخّصِ اليوم ═════
// تُحسَبُ من الطلباتِ المحمّلةِ نفسِها (آخرُ ٢٠٠) بلا طلبٍ إضافيّ: كلُّ طلبٍ غيرِ ملغى
// بقيمتِه، كما يحسبُ «مبيعات اليوم» فوقها. اليومُ عمودٌ داكن، والباقي رماديّ؛ ضغطةٌ على
// عمودٍ تكتبُ يومَه وقيمتَه بالرأس. والمقارنةُ بالأسبوعِ الذي قبله لا تظهرُ إلّا إن كانت
// الطلباتُ المحمّلةُ تغطّيه كلَّه — وإلّا لكانت نسبةً كاذبة.
function WeekBars({ orders }) {
  const { t, i18n } = useTranslation();
  const [pick, setPick] = useState(null);
  const DAY = 86400000;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() - (6 - i) * DAY);
    return { d, key: dayKey(d.toISOString()), sum: 0, n: 0 };
  });
  const byKey = Object.fromEntries(days.map((x) => [x.key, x]));
  const weekFrom = days[0].d.getTime();
  const prevFrom = weekFrom - 7 * DAY;
  let prev = 0;
  let oldest = Infinity;
  for (const o of orders) {
    const ts = new Date(o.createdAt).getTime();
    if (ts < oldest) oldest = ts;
    if (o.status === 'cancelled') continue;
    const v = Number(o.total) || 0;
    const slot = byKey[dayKey(o.createdAt)];
    if (slot && ts >= weekFrom) { slot.sum += v; slot.n += 1; }
    else if (ts >= prevFrom && ts < weekFrom) prev += v;
  }
  const total = days.reduce((n, x) => n + x.sum, 0);
  const max = Math.max(...days.map((x) => x.sum), 1);
  const covered = orders.length < 200 || oldest <= prevFrom;
  const pct = covered && prev > 0 ? Math.round(((total - prev) / prev) * 100) : null;
  const locale = i18n.language === 'en' ? 'en-GB' : 'ar-EG';
  // الحرفُ الواحدُ (ح، ج) لا يُقرأ: أسماءٌ قصيرةٌ بلا «ال» تتّسعُ لعمودِها
  const AR_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const wd = (d, long) => (long || i18n.language === 'en'
    ? d.toLocaleDateString(locale, { weekday: long ? 'long' : 'short' })
    : AR_SHORT[d.getDay()]);
  const cur = t('common.currency');
  const sel = pick != null ? days[pick] : null;
  if (!total && !prev) return null;
  return (
    <div className="bz-oweek col-span-3 px-3.5 pb-3 pt-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="bz-osum-k text-[11px] font-semibold">
          {sel ? `${wd(sel.d, true)} · ${t('dashboard.ordersSection.weekOrders', { count: sel.n })}` : t('dashboard.ordersSection.week')}
        </p>
        <p className="flex items-baseline gap-1.5">
          {!sel && pct != null && (
            <span className={`bz-oweek-pct text-[10.5px] font-bold tabular-nums ${pct >= 0 ? 'is-up' : 'is-down'}`} title={t('dashboard.ordersSection.weekVs')}>
              {pct >= 0 ? '▲' : '▼'}{Math.abs(pct)}%
            </span>
          )}
          <span className="bz-osum-v font-display text-[15px] font-extrabold tabular-nums">{cur}{Math.round(sel ? sel.sum : total).toLocaleString()}</span>
        </p>
      </div>
      <div className="mt-2 flex h-14 items-end gap-1.5" role="list">
        {days.map((x, i) => {
          const today = i === 6;
          const on = pick === i;
          return (
            <button
              key={x.key}
              type="button"
              role="listitem"
              onClick={() => setPick(on ? null : i)}
              aria-label={`${wd(x.d, true)}: ${cur}${Math.round(x.sum)}`}
              className="group flex h-full flex-1 flex-col items-center justify-end"
            >
              <span
                className={`bz-oweek-bar w-full max-w-[28px] rounded-t-md rounded-b-[3px] ${today ? 'is-today' : ''} ${on ? 'is-on' : ''} ${pick != null && !on ? 'is-dim' : ''}`}
                style={{ height: x.sum ? `${Math.max(8, (x.sum / max) * 100)}%` : '3px' }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {days.map((x, i) => (
          <span key={x.key} className={`flex-1 text-center text-[10px] ${i === 6 ? 'bz-osum-v font-bold' : 'bz-osum-k'}`}>{i === 6 ? t('dashboard.ordersSection.today') : wd(x.d)}</span>
        ))}
      </div>
    </div>
  );
}
