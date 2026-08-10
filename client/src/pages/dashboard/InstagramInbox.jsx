import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { InstagramIcon, BagIcon, BackIcon, CheckIcon, TrashIcon, PlusIcon } from '../../components/icons.jsx';
import { startFbLogin, igRedirectUri } from '../../utils/fbSdk.js';
import { cldThumb } from '../../utils/cloudinary.js';

// ننظّف رابط الصفحة من بارامترات العودة (code/state) بعد معالجتها
function cleanOauthUrl() {
  try { window.history.replaceState({}, '', '/dashboard?tab=instagram'); } catch { /* تجاهل */ }
}

export default function InstagramInbox() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [pendingPages, setPendingPages] = useState(null); // عدّة صفحات بعد العودة من فيسبوك

  const loadStatus = () =>
    api.get('/instagram/status').then((r) => setStatus(r.data)).catch((e) => setError(getErrorMessage(e)));

  // عند التحميل: لو رجعنا من فيسبوك (?code=) نكمّل الربط، وإلا نجلب الحالة عادةً.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (params.get('error')) { setError(t('dashboard.instagram.loginCancelled')); cleanOauthUrl(); loadStatus(); return; }
    if (code) {
      api.post('/instagram/connect', { code, redirectUri: igRedirectUri() })
        .then((r) => { if (r.data.pages) setPendingPages(r.data.pages); })
        .catch((e) => setError(getErrorMessage(e)))
        .finally(() => { cleanOauthUrl(); loadStatus(); });
      return;
    }
    loadStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!status && !error) return <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold gradient-text">
          <InstagramIcon className="h-6 w-6" /> {t('dashboard.instagram.title')}
        </h1>
        <p className="mt-1 text-sm text-stone-400">{t('dashboard.instagram.hint')}</p>
      </div>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {/* حلّ عملي فوري: تسجيل طلب من محادثة يدوياً — يعمل الآن بلا انتظار موافقة Meta */}
      <ManualOrderPanel />

      {status && !status.connected ? (
        <ConnectCard status={status} pendingPages={pendingPages} onConnected={() => { setPendingPages(null); loadStatus(); }} />
      ) : status ? (
        <Inbox username={status.username} onDisconnected={loadStatus} />
      ) : null}
    </div>
  );
}

// ───────── بطاقة الربط (تسجيل دخول فيسبوك بإعادة توجيه) ─────────
function ConnectCard({ status, pendingPages, onConnected }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pages = pendingPages; // تظهر بعد العودة من فيسبوك لو عنده عدّة صفحات

  // الزر الأساسي: يوجّه لفيسبوك (الصفحة تروح وترجع بـ ?code=) — بلا نوافذ منبثقة.
  const start = () => {
    setError('');
    startFbLogin({ appId: status.appId, configId: status.configId, graphVersion: status.graphVersion });
  };

  // اختيار صفحة معيّنة (خطوة ثانية): يكمّل الربط بالتوكن المخزّن مؤقّتاً بالخادم.
  const pick = async (pageId) => {
    setBusy(true); setError('');
    try {
      await api.post('/instagram/connect', { pageId });
      onConnected();
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  };

  if (!status.enabled) {
    return (
      <div className="glass p-8 text-center">
        <InstagramIcon className="mx-auto h-10 w-10 text-stone-500" />
        <p className="mt-3 text-sm text-stone-300">{t('dashboard.instagram.notEnabled')}</p>
      </div>
    );
  }

  return (
    <div className="glass space-y-4 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-amber-500 text-white shadow-md">
          <InstagramIcon className="h-6 w-6" />
        </span>
        <div>
          <p className="font-display text-base font-bold text-gold-200">{t('dashboard.instagram.connectTitle')}</p>
          <p className="mt-1 text-sm text-stone-400">{t('dashboard.instagram.connectHint')}</p>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {pages && pages.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-stone-300">{t('dashboard.instagram.choosePage')}</p>
          {pages.map((p) => (
            <button
              key={p.pageId}
              onClick={() => pick(p.pageId)}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-sm text-stone-100 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
            >
              <span>{p.name || p.pageId}{p.username ? <span className="text-gold-300"> · @{p.username}</span> : null}</span>
              <BackIcon className="h-4 w-4 rotate-180 text-stone-400" />
            </button>
          ))}
        </div>
      ) : (
        <button onClick={start} disabled={busy} className="btn-primary gap-2">
          <InstagramIcon className="h-5 w-5" /> {t('dashboard.instagram.connectBtn')}
        </button>
      )}

      <ul className="space-y-1.5 border-t border-white/5 pt-3 text-xs text-stone-400">
        <li className="flex gap-2"><CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" /> {t('dashboard.instagram.req1')}</li>
        <li className="flex gap-2"><CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" /> {t('dashboard.instagram.req2')}</li>
      </ul>
    </div>
  );
}

// ───────── الصندوق: قائمة المحادثات + محادثة مفتوحة ─────────
function Inbox({ username, onDisconnected }) {
  const { t } = useTranslation();
  const [convs, setConvs] = useState(null);
  const [openId, setOpenId] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    api.get('/instagram/conversations').then((r) => setConvs(r.data.conversations)).catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  const disconnect = async () => {
    try { await api.post('/instagram/disconnect'); onDisconnected(); } catch (e) { setError(getErrorMessage(e)); }
  };

  const patchConv = (id, patch) => setConvs((prev) => (prev || []).map((c) => (c.id === id ? { ...c, ...patch } : c)));

  if (convs === null && !error) return <Spinner />;

  const open = (convs || []).find((c) => c.id === openId);

  return (
    <div className="space-y-4">
      {/* شريط الحساب المربوط */}
      <div className="glass flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-sm text-stone-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-amber-500 text-white"><InstagramIcon className="h-4 w-4" /></span>
          {username ? <span dir="ltr" className="font-semibold text-gold-200">@{username}</span> : t('dashboard.instagram.connected')}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost !py-1.5 text-xs">{t('common.refresh')}</button>
          <button onClick={disconnect} className="text-xs text-stone-400 underline-offset-2 hover:text-red-300 hover:underline">{t('dashboard.instagram.disconnect')}</button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {open ? (
        <Conversation
          conv={open}
          onBack={() => setOpenId('')}
          onRead={() => patchConv(open.id, { unread: 0 })}
          onConverted={(orderId) => patchConv(open.id, { order_id: orderId })}
        />
      ) : (convs && convs.length === 0) ? (
        <div className="glass p-10 text-center text-stone-400">{t('dashboard.instagram.empty')}</div>
      ) : (
        <div className="space-y-2">
          {(convs || []).map((c) => (
            <button
              key={c.id}
              onClick={() => setOpenId(c.id)}
              className="glass flex w-full items-center gap-3 p-3 text-start transition hover:bg-white/5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-gold-200 ring-1 ring-white/10">
                {(c.customer_name || c.customer_username || '؟').slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold text-stone-100">{c.customer_name || (c.customer_username ? `@${c.customer_username}` : t('dashboard.instagram.customer'))}</span>
                  {c.order_id && <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/25">{t('dashboard.instagram.hasOrder')}</span>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-stone-400">{c.last_message || '—'}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[10px] text-stone-500">{new Date(c.last_at).toLocaleDateString()}</span>
                {c.unread > 0 && <span className="rounded-full bg-gold-400 px-1.5 text-[10px] font-bold text-wine-dark">{c.unread}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────── محادثة واحدة: رسائل + ردّ + تحويل لطلب ─────────
function Conversation({ conv, onBack, onRead, onConverted }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null); // { conversation, messages }
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showConvert, setShowConvert] = useState(false);

  const load = () =>
    api.get(`/instagram/conversations/${conv.id}/messages`)
      .then((r) => { setData(r.data); onRead(); })
      .catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, [conv.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true); setError('');
    // تفاؤلي — نضيف الرسالة فوراً
    const optimistic = { id: 'tmp-' + Date.now(), direction: 'out', text: body, created_at: new Date().toISOString() };
    setData((d) => ({ ...d, messages: [...(d?.messages || []), optimistic] }));
    setText('');
    try {
      await api.post(`/instagram/conversations/${conv.id}/reply`, { text: body });
    } catch (e) {
      setError(getErrorMessage(e));
      setData((d) => ({ ...d, messages: (d?.messages || []).filter((m) => m.id !== optimistic.id) }));
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const c = data?.conversation || conv;
  const name = c.customer_name || (c.customer_username ? `@${c.customer_username}` : t('dashboard.instagram.customer'));
  const converted = Boolean(c.order_id || conv.order_id);

  return (
    <div className="glass flex flex-col overflow-hidden">
      {/* رأس المحادثة */}
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2.5">
        <button onClick={onBack} className="rounded-lg p-1.5 text-stone-300 transition hover:bg-white/10" aria-label={t('common.back')}>
          <BackIcon className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 truncate font-semibold text-stone-100">{name}</span>
        {converted ? (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/25">{t('dashboard.instagram.hasOrder')}</span>
        ) : (
          <button onClick={() => setShowConvert((v) => !v)} className="inline-flex items-center gap-1 rounded-xl bg-gold-400 px-3 py-1.5 text-xs font-bold text-wine-dark shadow-sm transition hover:bg-gold-300">
            <BagIcon className="h-4 w-4" /> {showConvert ? t('common.cancel') : t('dashboard.instagram.toOrder')}
          </button>
        )}
      </div>

      {showConvert && !converted && (
        <ConvertForm
          convId={conv.id}
          defaultName={c.customer_name || ''}
          onDone={(orderId) => { setShowConvert(false); onConverted(orderId); }}
        />
      )}

      {/* الرسائل */}
      <div className="flex max-h-[52vh] min-h-[200px] flex-col gap-2 overflow-y-auto px-3 py-4">
        {!data ? (
          <Spinner />
        ) : data.messages.length === 0 ? (
          <p className="my-auto text-center text-sm text-stone-500">{t('dashboard.instagram.noMessages')}</p>
        ) : (
          data.messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                m.direction === 'out' ? 'bg-gold-400/15 text-gold-100 ring-1 ring-gold-400/20' : 'bg-white/5 text-stone-100 ring-1 ring-white/10'
              }`}>
                {m.attachment_url ? (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer" className="underline">📎 {t('dashboard.instagram.attachment')}</a>
                ) : null}
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                <span className="mt-0.5 block text-[10px] text-stone-500">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {error && <div className="mx-3 mb-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

      {/* صندوق الردّ */}
      <div className="flex items-end gap-2 border-t border-white/5 p-3">
        <textarea
          className="input min-h-[42px] flex-1 resize-none"
          rows={1}
          placeholder={t('dashboard.instagram.replyPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={send} disabled={sending || !text.trim()} className="btn-primary shrink-0 !px-4 !py-2.5 text-sm disabled:opacity-50">
          {sending ? t('common.loading') : t('dashboard.instagram.send')}
        </button>
      </div>
      <p className="px-3 pb-3 text-[11px] text-stone-500">{t('dashboard.instagram.window24')}</p>
    </div>
  );
}

// ───────── نموذج تحويل المحادثة لطلب ─────────
function ConvertForm({ convId, defaultName, onDone }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState(null);
  const [picked, setPicked] = useState([]); // [{id, name, price, qty, size, color}]
  const [q, setQ] = useState('');
  const [f, setF] = useState({ name: defaultName, phone: '', city: '', address: '', deliveryFee: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/products').then((r) => setProducts(r.data.products || [])).catch(() => setProducts([]));
  }, []);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const add = (p) => {
    if (picked.some((x) => x.id === p.id)) return;
    setPicked((prev) => [...prev, { id: p.id, name: p.name, price: Number(p.price) || 0, qty: 1, size: '', color: '' }]);
    setQ('');
  };
  const setItem = (id, patch) => setPicked((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeItem = (id) => setPicked((prev) => prev.filter((x) => x.id !== id));

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return (products || []).filter((p) => (p.name || '').toLowerCase().includes(term)).slice(0, 6);
  }, [q, products]);

  const subtotal = picked.reduce((s, x) => s + x.price * Math.max(1, x.qty), 0);
  const total = subtotal + (Number(f.deliveryFee) || 0);

  const submit = async () => {
    if (!picked.length) { setError(t('dashboard.instagram.needProduct')); return; }
    if (!f.name.trim() || !f.phone.trim()) { setError(t('dashboard.instagram.needCustomer')); return; }
    setBusy(true); setError('');
    try {
      const res = await api.post(`/instagram/conversations/${convId}/convert`, {
        items: picked.map((x) => ({ id: x.id, qty: x.qty, size: x.size, color: x.color })),
        customer: { name: f.name, phone: f.phone, city: f.city, address: f.address, deliveryFee: f.deliveryFee, notes: f.notes },
      });
      try { window.dispatchEvent(new Event('bz:orders-changed')); } catch { /* تجاهل */ }
      onDone(res.data.orderId);
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-b border-white/5 bg-gold-400/5 p-3">
      <p className="text-xs font-semibold text-gold-200">{t('dashboard.instagram.convertTitle')}</p>

      {/* اختيار المنتجات */}
      <div className="relative">
        <input className="input" placeholder={t('dashboard.instagram.searchProduct')} value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl bg-[#241a15] shadow-xl ring-1 ring-white/10">
            {results.map((p) => (
              <button key={p.id} onClick={() => add(p)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-stone-100 transition hover:bg-white/10">
                {p.images?.[0] ? <img src={cldThumb(p.images[0], 80)} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded bg-white/5"><BagIcon className="h-4 w-4 text-stone-500" /></span>}
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-gold-300">{t('common.currency')}{Number(p.price).toFixed(0)}</span>
                <PlusIcon className="h-4 w-4 text-gold-300" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* المنتجات المختارة */}
      {picked.map((x) => (
        <div key={x.id} className="flex items-center gap-2 rounded-xl bg-black/20 px-2.5 py-2 ring-1 ring-white/5">
          <span className="min-w-0 flex-1 truncate text-sm text-stone-100">{x.name}</span>
          <input className="input !w-24 !py-1 text-xs" placeholder={t('dashboard.instagram.size')} value={x.size} onChange={(e) => setItem(x.id, { size: e.target.value })} />
          <input className="input !w-16 !py-1 text-center text-xs" type="number" min="1" inputMode="numeric" value={x.qty} onChange={(e) => setItem(x.id, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
          <button onClick={() => removeItem(x.id)} className="rounded-lg p-1.5 text-stone-400 hover:text-red-300"><TrashIcon className="h-4 w-4" /></button>
        </div>
      ))}

      {/* بيانات الزبون */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className="input" placeholder={t('dashboard.instagram.custName')} value={f.name} onChange={set('name')} />
        <input className="input" placeholder={t('dashboard.instagram.custPhone')} value={f.phone} onChange={set('phone')} dir="ltr" />
        <input className="input" placeholder={t('dashboard.ordersSection.deliveryTo')} value={f.city} onChange={set('city')} />
        <input className="input" type="number" min="0" step="0.5" inputMode="decimal" placeholder={t('dashboard.ordersSection.delivery')} value={f.deliveryFee} onChange={set('deliveryFee')} />
        <input className="input sm:col-span-2" placeholder={t('dashboard.ordersSection.address')} value={f.address} onChange={set('address')} />
        <input className="input sm:col-span-2" placeholder={t('dashboard.ordersSection.notes')} value={f.notes} onChange={set('notes')} />
      </div>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={submit} disabled={busy} className="btn-primary gap-1.5 !px-3 !py-1.5 text-xs disabled:opacity-50">
          {busy ? t('common.loading') : <><BagIcon className="h-4 w-4" /> {t('dashboard.instagram.createOrder')}</>}
        </button>
        <span className="text-xs text-stone-400">
          {t('dashboard.ordersSection.total')}: <span className="font-display text-sm font-bold text-gold-300">{t('common.currency')}{total.toFixed(2)}</span>
        </span>
      </div>
    </div>
  );
}

// ───────── حلّ عملي: تسجيل طلب من محادثة يدوياً (يعمل الآن بلا Meta) ─────────
function ManualOrderPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(null); // { reference }

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-amber-500 text-wine-dark shadow-md">
          <BagIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-gold-200">{t('dashboard.instagram.manualTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-400">{t('dashboard.instagram.manualNote')}</p>
        </div>
        <button
          onClick={() => { setOpen((v) => !v); setDone(null); }}
          className="btn-primary shrink-0 gap-1 !px-3 !py-1.5 text-xs"
        >
          <PlusIcon className="h-4 w-4" /> {open ? t('common.cancel') : t('dashboard.instagram.newOrder')}
        </button>
      </div>

      {done && (
        <div className="mx-4 mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">
          {t('dashboard.instagram.orderCreated')} — <span dir="ltr" className="font-mono font-bold">{done.reference}</span>
        </div>
      )}

      {open && <ManualOrderForm onDone={(reference) => { setOpen(false); setDone({ reference }); }} />}
    </div>
  );
}

// نفس منطق نموذج التحويل، لكنه ينشئ طلباً مباشرةً عبر /orders/cod (بلا محادثة مربوطة)
function ManualOrderForm({ onDone }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState(null);
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ name: '', phone: '', city: '', address: '', deliveryFee: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/products').then((r) => setProducts(r.data.products || [])).catch(() => setProducts([]));
  }, []);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const add = (p) => {
    if (picked.some((x) => x.id === p.id)) return;
    setPicked((prev) => [...prev, { id: p.id, name: p.name, price: Number(p.price) || 0, qty: 1, size: '', color: '' }]);
    setQ('');
  };
  const setItem = (id, patch) => setPicked((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeItem = (id) => setPicked((prev) => prev.filter((x) => x.id !== id));

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return (products || []).filter((p) => (p.name || '').toLowerCase().includes(term)).slice(0, 6);
  }, [q, products]);

  const subtotal = picked.reduce((s, x) => s + x.price * Math.max(1, x.qty), 0);
  const total = subtotal + (Number(f.deliveryFee) || 0);

  const submit = async () => {
    if (!picked.length) { setError(t('dashboard.instagram.needProduct')); return; }
    if (!f.name.trim() || !f.phone.trim()) { setError(t('dashboard.instagram.needCustomer')); return; }
    setBusy(true); setError('');
    try {
      const res = await api.post('/orders/cod', {
        items: picked.map((x) => ({ id: x.id, qty: x.qty, size: x.size, color: x.color })),
        customer: { name: f.name, phone: f.phone, city: f.city, address: f.address, deliveryFee: f.deliveryFee, notes: f.notes },
      });
      try { window.dispatchEvent(new Event('bz:orders-changed')); } catch { /* تجاهل */ }
      onDone(res.data.reference || '');
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-white/5 bg-gold-400/5 p-3">
      {/* اختيار المنتجات */}
      <div className="relative">
        <input className="input" placeholder={t('dashboard.instagram.searchProduct')} value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl bg-[#241a15] shadow-xl ring-1 ring-white/10">
            {results.map((p) => (
              <button key={p.id} onClick={() => add(p)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-stone-100 transition hover:bg-white/10">
                {p.images?.[0] ? <img src={cldThumb(p.images[0], 80)} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded bg-white/5"><BagIcon className="h-4 w-4 text-stone-500" /></span>}
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-gold-300">{t('common.currency')}{Number(p.price).toFixed(0)}</span>
                <PlusIcon className="h-4 w-4 text-gold-300" />
              </button>
            ))}
          </div>
        )}
      </div>

      {picked.map((x) => (
        <div key={x.id} className="flex items-center gap-2 rounded-xl bg-black/20 px-2.5 py-2 ring-1 ring-white/5">
          <span className="min-w-0 flex-1 truncate text-sm text-stone-100">{x.name}</span>
          <input className="input !w-24 !py-1 text-xs" placeholder={t('dashboard.instagram.size')} value={x.size} onChange={(e) => setItem(x.id, { size: e.target.value })} />
          <input className="input !w-16 !py-1 text-center text-xs" type="number" min="1" inputMode="numeric" value={x.qty} onChange={(e) => setItem(x.id, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
          <button onClick={() => removeItem(x.id)} className="rounded-lg p-1.5 text-stone-400 hover:text-red-300"><TrashIcon className="h-4 w-4" /></button>
        </div>
      ))}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className="input" placeholder={t('dashboard.instagram.custName')} value={f.name} onChange={set('name')} />
        <input className="input" placeholder={t('dashboard.instagram.custPhone')} value={f.phone} onChange={set('phone')} dir="ltr" />
        <input className="input" placeholder={t('dashboard.ordersSection.deliveryTo')} value={f.city} onChange={set('city')} />
        <input className="input" type="number" min="0" step="0.5" inputMode="decimal" placeholder={t('dashboard.ordersSection.delivery')} value={f.deliveryFee} onChange={set('deliveryFee')} />
        <input className="input sm:col-span-2" placeholder={t('dashboard.ordersSection.address')} value={f.address} onChange={set('address')} />
        <input className="input sm:col-span-2" placeholder={t('dashboard.ordersSection.notes')} value={f.notes} onChange={set('notes')} />
      </div>

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={submit} disabled={busy} className="btn-primary gap-1.5 !px-3 !py-1.5 text-xs disabled:opacity-50">
          {busy ? t('common.loading') : <><BagIcon className="h-4 w-4" /> {t('dashboard.instagram.createOrder')}</>}
        </button>
        <span className="text-xs text-stone-400">
          {t('dashboard.ordersSection.total')}: <span className="font-display text-sm font-bold text-gold-300">{t('common.currency')}{total.toFixed(2)}</span>
        </span>
      </div>
    </div>
  );
}
