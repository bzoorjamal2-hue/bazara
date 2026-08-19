import { useEffect, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { buildWhatsappLink, waCandidates } from '../../utils/whatsapp.js';
import { getCache, setCache } from '../../utils/apiCache.js';
import { downloadXlsx } from '../../utils/xlsx.js';
import { htmlToPngBlob, safeFileName, downloadBlob } from '../../utils/htmlImage.js';
import { PinIcon, NoteIcon, TicketIcon, WhatsAppIcon, TruckIcon, BellIcon, TrashIcon, BagIcon, ReceiptIcon, SearchIcon, XIcon, DownloadIcon, CheckIcon, CopyIcon, PhoneIcon, PrintIcon, ImageIcon } from '../../components/icons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCouriers, syncCourierStatuses, courierOf, CourierLock, CourierSend } from '../../components/couriers.jsx';
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

export default function OrdersManager() {
  const { t } = useTranslation();
  const { store } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  // ربط شركات التوصيل (أوبتيموس/EPS/gobox): حالة الربط + المدن/الأنواع مرّة واحدة للصفحة
  const couriers = useCouriers();
  // طلبات لم تكتمل (سلات متروكة ببيانات تواصل) — لمتابعتها برسالة وإنقاذ البيع
  const [abandoned, setAbandoned] = useState([]);
  // فلترة وبحث بالطلبات: حالة + اسم/هاتف/رقم طلب — للوصول لأي طلب بثوانٍ
  const [statusFilter, setStatusFilter] = useState('all');
  const [oq, setOq] = useState('');
  const [toast, setToast] = useState(''); // رسالة خاطفة (نسخ التفاصيل)

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
      if (store?.id) setCache(`myorders:${store.id}`, list);
      // مزامنة حالة الشحنات المُرسلة (أوبتيموس/EPS/gobox) مع حالتها الحيّة هناك
      const patch = await syncCourierStatuses(list);
      if (on && patch) setOrders((prev) => prev.map((o) => (patch[o.id] ? { ...o, ...patch[o.id] } : o)));
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

  const setStatus = async (id, status) => {
    setSavingId(id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o))); // تفاؤلي
    try {
      await api.patch(`/orders/${id}/status`, { status });
      pingOrdersChanged(); // الشارة تنقص فوراً عند التأكيد/الشحن
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingId('');
    }
  };

  // إرسال الطلب عبر واتساب برسالة جاهزة — لشركة التوصيل إن حُدّدت، وإلا لواتساب صاحب المتجر
  const sendToDelivery = (o) => {
    const num = store?.deliveryPhone || store?.whatsapp;
    if (!num) return;
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
    window.open(buildWhatsappLink(num, msg), '_blank');
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

  // الخطوة التالية المنطقية بمسار الطلب — زرّ واحد بدل فتح القائمة كل مرّة
  const NEXT = { new: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };

  // رقم الطلب المعروض: المرجع القصير (BZ-…) الذي يعرفه الزبون. وإن غاب (طلبات
  // قديمة) نعرض آخر ٦ خانات من المعرّف بدل UUID كامل يملأ السطر.
  const orderNo = (o) => o.reference || `#${String(o.id).replace(/-/g, '').slice(-6).toUpperCase()}`;

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
      o.notes ? `${t('dashboard.ordersSection.notes')}: ${o.notes}` : '',
    ].filter(Boolean).join('\n');
  };

  const copyOrder = async (o) => {
    try { await navigator.clipboard.writeText(orderText(o)); setToast(t('common.copied')); setTimeout(() => setToast(''), 1600); } catch { /* تجاهُل */ }
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
      <td class="e">${cur}${Number(it.price || 0).toFixed(2)}</td>
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
            <th class="e">${e(t('dashboard.ordersSection.unitPrice'))}</th>
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

        <div class="pay">${e(t('dashboard.ordersSection.payCod'))}</div>
        <div class="thanks">${e(t('dashboard.ordersSection.invoiceThanks', { store: store?.name || '' }))}</div>
      </div>`;
  };

  // أنماط الفاتورة (A4) — مشتركة بين فاتورة واحدة وطباعة عدّة فواتير
  const INVOICE_CSS = `
    *{box-sizing:border-box}
    body{font-family:'Cairo','Segoe UI',Tahoma,sans-serif;color:#2b2b2b;margin:0;padding:0;background:#fff}
    .inv{padding:22px 24px;max-width:800px;margin:0 auto}
    .inv + .inv{page-break-before:always}
    h1{font-size:19px;margin:0 0 4px;color:#8a6a2f}
    .muted{color:#6b6b6b;font-size:11.5px;line-height:1.7}
    /* خيط ذهبي متدرّج أسفل الترويسة بدل خطّ مصمت — هوية بازارا الذهبية */
    .head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:12px;margin-bottom:14px;border-bottom:3px solid;border-image:linear-gradient(90deg,#e6c878,#d4af37,#b8932c) 1}
    .inv-meta{text-align:end}
    .tag{display:inline-block;background:#d4af37;color:#3f2e22;font-weight:800;font-size:11px;padding:2px 10px;border-radius:99px;margin-bottom:4px}
    .no{font-weight:800;font-size:14px;letter-spacing:.5px}
    .grid2{display:flex;gap:10px;margin-bottom:10px}
    .box{flex:1;border:1px solid #e3ddd3;border-radius:10px;padding:9px 11px;font-size:12.5px;line-height:1.7}
    .box-t{color:#8a7f75;font-size:10.5px;font-weight:700;margin-bottom:2px}
    .note{margin-bottom:10px}
    table{width:100%;border-collapse:collapse;font-size:12.5px}
    th{background:linear-gradient(180deg,#f7efdc,#f1e6cd);color:#6b5320;text-align:start;padding:8px;border-bottom:2px solid #d4af37;font-size:11.5px;font-weight:700}
    td{padding:7px 8px;border-bottom:1px solid #f0ebe3;vertical-align:middle}
    .n{width:28px;text-align:center;color:#8a7f75}
    .c{text-align:center;width:64px}
    .e{text-align:end;width:96px}
    .b{font-weight:700}
    .lbl{color:#6b6b6b}
    .total td{font-weight:800;font-size:15px;color:#6b5320;border-top:2px solid #d4af37;background:linear-gradient(180deg,#fdf7e8,#f9f0dc)}
    small{color:#6b6b6b}
    .pay{margin-top:10px;font-size:12px;color:#3f2e22;background:#f6f1e8;border-radius:8px;padding:7px 10px}
    .thanks{margin-top:10px;text-align:center;color:#8a7f75;font-size:11.5px}
    @page{size:A4;margin:10mm}
  `;

  // الطباعة داخل إطار مخفيّ (أوثق من نافذة منبثقة تحجبها المتصفّحات)
  const printHtml = (body, title) => {
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>${INVOICE_CSS}</style></head><body>${body}</body></html>`;
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;inset-inline-end:-9999px;width:0;height:0;border:0';
    document.body.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      f.contentWindow.focus();
      f.contentWindow.print();
      setTimeout(() => f.remove(), 1500);
    }, 300);
  };

  // عنوان المستند يصير اسم ملف PDF عند «حفظ كـPDF» بحوار الطباعة — نجعله باسم
  // الزبونة ورقم طلبها بدل عنوان لوحة بازارا.
  const invoiceName = (o) => safeFileName(`${t('dashboard.ordersSection.invoice')} - ${o.customerName || ''} - ${orderNo(o)}`);
  const printInvoice = (o) => printHtml(invoiceBody(o), invoiceName(o));

  // حفظ الفاتورة صورة PNG — أسهل للإرسال بواتساب من ملف PDF
  const saveInvoiceImage = async (o) => {
    try {
      setToast(t('dashboard.ordersSection.savingImage'));
      const blob = await htmlToPngBlob(invoiceBody(o), INVOICE_CSS);
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
  const exportExcel = () => {
    if (!orders?.length) return;
    const o2 = (k) => t(`dashboard.ordersSection.${k}`);
    const p2 = (k) => t(`dashboard.product.${k}`);
    const dest = (o) => [o.city, o.area && o.area !== o.city ? o.area : ''].filter(Boolean).join(' - ');

    const ordersSheet = {
      name: o2('sheetOrders'),
      columns: [
        { header: '#', width: 9, type: 'int' },
        { header: o2('date'), width: 20 },
        { header: o2('customer'), width: 22 },
        { header: o2('phone'), width: 16 },
        { header: o2('deliveryTo'), width: 18 },
        { header: o2('address'), width: 30 },
        { header: o2('items'), width: 40 },
        { header: o2('subtotal'), width: 13, type: 'money' },
        { header: o2('discount'), width: 12, type: 'money' },
        { header: o2('coupon'), width: 14 },
        { header: o2('delivery'), width: 12, type: 'money' },
        { header: o2('total'), width: 14, type: 'money' },
        { header: o2('status'), width: 14 },
      ],
      rows: orders.map((o) => [
        o.id,
        new Date(o.createdAt).toLocaleString(),
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
        o2(o.status),
      ]),
    };

    // ورقة القطع: سطر مستقلّ لكل قطعة بكل طلب — أساس الجرد ومعرفة الأكثر مبيعاً
    const itemRows = [];
    orders.forEach((o) => (o.items || []).forEach((it) => itemRows.push([
      o.id,
      new Date(o.createdAt).toLocaleDateString(),
      o.customerName || '',
      it.name || '',
      it.size || '',
      it.color || '',
      Number(it.qty || 0),
      Number(it.price || 0),
      Number(((it.price || 0) * (it.qty || 0)).toFixed(2)),
      o2(o.status),
    ])));
    const itemsSheet = {
      name: o2('sheetItems'),
      columns: [
        { header: '#', width: 9, type: 'int' },
        { header: o2('date'), width: 14 },
        { header: o2('customer'), width: 20 },
        { header: p2('name'), width: 30 },
        { header: p2('size'), width: 10 },
        { header: p2('color'), width: 12 },
        { header: p2('qty'), width: 9, type: 'int' },
        { header: p2('price'), width: 12, type: 'money' },
        { header: o2('total'), width: 13, type: 'money' },
        { header: o2('status'), width: 14 },
      ],
      rows: itemRows,
    };

    // المبيعات المحتسَبة = الطلبات المؤكّدة/المشحونة/المسلّمة (كما بصفحة الإحصائيات)
    const paid = orders.filter((o) => ['confirmed', 'shipped', 'delivered'].includes(o.status));
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
        { header: p2('qty'), width: 12, type: 'int' },
        { header: o2('ordersCountLabel'), width: 14, type: 'int' },
        { header: t('dashboard.analytics.revenue'), width: 16, type: 'money' },
      ],
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
        { header: o2('date'), width: 16 },
        { header: o2('ordersCountLabel'), width: 14, type: 'int' },
        { header: p2('qty'), width: 12, type: 'int' },
        { header: t('dashboard.analytics.revenue'), width: 16, type: 'money' },
      ],
      rows: [...dayMap.values()].sort((a, b) => a.ts - b.ts).map((d) => [d.day, d.orders, d.pieces, money(d.revenue)]),
    };

    // ٥) الزبائن — من طلب أكثر ومن أنفق أكثر (أساس المكافآت وإعادة الاستهداف)
    const customers = groupBy(paid, (o) => (o.customerPhone || o.customerName || '').trim(), (o) => ({ name: o.customerName || '' }));
    const customersSheet = {
      name: o2('sheetCustomers'),
      columns: [
        { header: o2('customer'), width: 24 },
        { header: o2('phone'), width: 18 },
        { header: o2('ordersCountLabel'), width: 14, type: 'int' },
        { header: t('dashboard.analytics.revenue'), width: 16, type: 'money' },
        { header: o2('date'), width: 16 },
      ],
      rows: customers.map((c) => [c.name || c.key, c.key, c.orders, money(c.revenue), new Date(c.last).toLocaleDateString()]),
    };

    // ٦) المدن — أين يتركّز البيع (لتسعير التوصيل واستهداف الإعلانات)
    const cities = groupBy(paid, (o) => (o.city || '').trim());
    const citiesSheet = {
      name: o2('sheetCities'),
      columns: [
        { header: o2('deliveryTo'), width: 22 },
        { header: o2('ordersCountLabel'), width: 14, type: 'int' },
        { header: t('dashboard.analytics.revenue'), width: 16, type: 'money' },
      ],
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
        action={orders?.length > 0 ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={printAllInvoices}
              title={t('dashboard.ordersSection.printAll')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gold-400/30 px-3 py-2 text-sm font-semibold text-gold-200 transition hover:bg-gold-400/10"
            >
              <PrintIcon className="h-4 w-4 shrink-0" /> <span>{t('dashboard.ordersSection.printAll')}</span>
            </button>
            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gold-400/30 px-3 py-2 text-sm font-semibold text-gold-200 transition hover:bg-gold-400/10"
            >
              <DownloadIcon className="h-4 w-4" /> {t('dashboard.ordersSection.export')}
            </button>
          </span>
        ) : null}
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
              const nums = waCandidates(a.phone);
              const pieces = (a.items || []).reduce((s, i) => s + (Number(i.qty) || 1), 0);
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gold-400/15 bg-black/20 p-3">
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
                      <a href={`https://wa.me/${nums[0]}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="btn-whatsapp gap-1.5 !px-3 !py-1.5 text-xs">
                        <WhatsAppIcon className="h-4 w-4" /> {t('dashboard.abandoned.nudge')}
                      </a>
                    )}
                    {nums[1] && (
                      <a href={`https://wa.me/${nums[1]}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" title={t('dashboard.ordersSection.waAltHint')} className="btn-whatsapp gap-1 !px-2.5 !py-1.5 text-xs opacity-80">
                        <WhatsAppIcon className="h-4 w-4" /> <span dir="ltr">+{nums[1].slice(0, 3)}</span>
                      </a>
                    )}
                    <button onClick={() => removeAbandoned(a.id)} aria-label={t('common.remove')} className="p-1.5 text-stone-500 transition hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* شريط الفلترة والبحث — يظهر عندما تكثر الطلبات ليصل المالك لأي طلب بثوانٍ */}
      {orders?.length > 3 && (
        <div className="dash-section glass space-y-4 p-5 sm:p-6">
          <SectionHead
            icon={<ReceiptIcon className="h-5 w-5" />}
            title={t('dashboard.ordersSection.title')}
            desc={t('dashboard.ordersSection.ordersCount', { count: orders.length })}
          />
          {/* الأيقونة والحقل بحاوية واحدة (لا تراكب) + زرّ تفريغ */}
          <div className="flex items-center gap-2 rounded-xl border border-gold-400/15 bg-black/20 px-3 focus-within:border-gold-400/60 focus-within:ring-2 focus-within:ring-gold-400/25">
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
          <div className="flex flex-wrap gap-1.5">
            {['all', ...FLOW].map((s) => {
              const n = s === 'all' ? (orders?.length || 0) : (statusCounts[s] || 0);
              if (s !== 'all' && n === 0) return null; // حالة بلا طلبات لا تشغل مكاناً
              const on = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  // النشط بذهب صريح (hex): bg-gold-400 تنقلب نهاراً لبنّي و text-wine-dark
                  // بنّي أغمق — بنّي على بنّي لا يُقرأ. الهيكس يتجاوز قلب الثيم.
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    on
                      ? 'border-[#d4af37] bg-[#d4af37] text-[#3f2e22] shadow-sm'
                      : 'border-gold-400/25 bg-gold-400/5 text-stone-300 hover:bg-gold-400/15 hover:text-gold-200'
                  }`}
                >
                  {s === 'all' ? t('common.all') : t(`dashboard.ordersSection.${s}`)}
                  <span className={`rounded-full px-1.5 text-[10px] font-bold ${on ? 'bg-[#3f2e22]/15 text-[#3f2e22]' : 'bg-gold-400/10 text-stone-400'}`}>{n}</span>
                </button>
              );
            })}
          </div>
          {/* عدد النتائج عند وجود تصفية فعّالة */}
          {(oq.trim() || statusFilter !== 'all') && visibleOrders.length > 0 && (
            <p className="text-[11px] text-stone-400">{t('dashboard.product.showing', { shown: visibleOrders.length, total: orders.length })}</p>
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
            const waNums = o.customerPhone ? waCandidates(o.customerPhone) : [];
            const wa = waNums[0] ? `https://wa.me/${waNums[0]}` : '';
            const waAlt = waNums[1] ? `https://wa.me/${waNums[1]}` : '';
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
              <div className="glass p-4">
                {/* رأس: الزبون + الحالة */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-100">{o.customerName || '—'}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-stone-400">
                      {o.customerPhone && <a href={`tel:${o.customerPhone.replace(/\s/g, '')}`} className="underline-offset-2 transition hover:text-gold-200 hover:underline" dir="ltr">{o.customerPhone}</a>}
                      <span>{new Date(o.createdAt).toLocaleString()}</span>
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {/* رقم الطلب القصير الذي يراه الزبون (BZ-…) لا معرّف قاعدة البيانات الطويل */}
                    <span className="rounded-full bg-gold-400/10 px-2 py-0.5 text-[10px] font-bold text-stone-400" dir="ltr">{orderNo(o)}</span>
                    <span className={`badge ${BADGE[o.status] || ''}`}>{t(`dashboard.ordersSection.${o.status}`)}</span>
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

                {/* تحديث الحالة + تواصل */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                  <span className="text-xs text-stone-400">{t('dashboard.ordersSection.updateStatus')}:</span>
                  {courierOf(o) ? (
                    // الطلب بعهدة شركة التوصيل → الحالة مُقفلة (تُدار من عندهم)
                    <CourierLock order={o} fallbackLabel={t(`dashboard.ordersSection.${FLOW.includes(o.status) ? o.status : 'shipped'}`)} />
                  ) : (
                    <div className="min-w-[140px]">
                      <Select
                        value={FLOW.includes(o.status) ? o.status : 'new'}
                        onChange={(v) => setStatus(o.id, v)}
                        options={FLOW.map((s) => ({ value: s, label: t(`dashboard.ordersSection.${s}`) }))}
                      />
                    </div>
                  )}
                  {/* الخطوة التالية بضغطة — أسرع من فتح القائمة لكل طلب */}
                  {!courierOf(o) && NEXT[o.status] && (
                    <button
                      onClick={() => setStatus(o.id, NEXT[o.status])}
                      disabled={savingId === o.id}
                      title={t('dashboard.ordersSection.moveTo', { status: t(`dashboard.ordersSection.${NEXT[o.status]}`) })}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckIcon className="h-4 w-4" /> {t(`dashboard.ordersSection.${NEXT[o.status]}`)}
                    </button>
                  )}
                  {savingId === o.id && <span className="text-xs text-stone-500">…</span>}
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="btn-whatsapp gap-1.5 !px-3 !py-1.5 text-xs"><WhatsAppIcon className="h-4 w-4" /> {t('dashboard.ordersSection.contactWhatsapp')}{waAlt ? <span dir="ltr" className="opacity-75">+{waNums[0].slice(0, 3)}</span> : null}</a>
                  )}
                  {waAlt && (
                    <a href={waAlt} target="_blank" rel="noreferrer" title={t('dashboard.ordersSection.waAltHint')} className="btn-whatsapp gap-1 !px-2.5 !py-1.5 text-xs opacity-80"><WhatsAppIcon className="h-4 w-4" /> <span dir="ltr">+{waNums[1].slice(0, 3)}</span></a>
                  )}
                  {/* رسالة جاهزة للزبون عن حالة طلبه الحالية (مع رقم التتبّع إن وُجد) */}
                  {wa && (
                    <a
                      href={`https://wa.me/${waNums[0]}?text=${encodeURIComponent(orderStatusMsg(o))}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-gold-400/30 px-3 py-1.5 text-xs font-semibold text-gold-200 transition hover:bg-gold-400/10"
                    >
                      <BellIcon className="h-4 w-4" /> {t('dashboard.ordersSection.notifyCustomer')}
                    </a>
                  )}
                  {(store?.deliveryPhone || store?.whatsapp) && (
                    <button onClick={() => sendToDelivery(o)} className="inline-flex items-center gap-1 rounded-xl border border-gold-400/30 px-3 py-1.5 text-xs font-semibold text-gold-200 transition hover:bg-gold-400/10">
                      <TruckIcon className="inline h-4 w-4" /> {t('dashboard.ordersSection.sendDelivery')}
                    </button>
                  )}
                  <CourierSend order={o} couriers={couriers} onSent={markSent} />

                  {/* أدوات الطلب: اتصال · نسخ التفاصيل · طباعة الفاتورة */}
                  <span className="ms-auto flex items-center gap-1.5">
                    {o.customerPhone && (
                      <a
                        href={`tel:${o.customerPhone.replace(/\s/g, '')}`}
                        title={t('dashboard.ordersSection.call')} aria-label={t('dashboard.ordersSection.call')}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-gold-400/20 text-stone-400 transition hover:border-gold-400/50 hover:text-gold-200"
                      >
                        <PhoneIcon className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={() => copyOrder(o)}
                      title={t('dashboard.ordersSection.copyOrder')} aria-label={t('dashboard.ordersSection.copyOrder')}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-gold-400/20 text-stone-400 transition hover:border-gold-400/50 hover:text-gold-200"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => saveInvoiceImage(o)}
                      title={t('dashboard.ordersSection.saveImage')} aria-label={t('dashboard.ordersSection.saveImage')}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-gold-400/20 text-stone-400 transition hover:border-gold-400/50 hover:text-gold-200"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => printInvoice(o)}
                      title={t('dashboard.ordersSection.printInvoice')} aria-label={t('dashboard.ordersSection.printInvoice')}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-gold-400/20 text-stone-400 transition hover:border-gold-400/50 hover:text-gold-200"
                    >
                      <PrintIcon className="h-4 w-4" />
                    </button>
                  </span>
                </div>
              </div>
              </Fragment>
            );
            });
          })()}
        </div>
      )}
    </div>
  );
}
