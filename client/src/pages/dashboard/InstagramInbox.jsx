import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import CitySearch from '../../components/CitySearch.jsx';
import { sizeLabel } from '../../utils/sizes.js';
import { isValidMobile, sanitizeMobileInput } from '../../utils/phone.js';
import { InstagramIcon, BagIcon, BackIcon, CheckIcon, TrashIcon, PlusIcon } from '../../components/icons.jsx';
import { startFbLogin, igRedirectUri } from '../../utils/fbSdk.js';
import { cldThumb, cldVideoPoster } from '../../utils/cloudinary.js';
import { PageHead } from '../../components/FormField.jsx';

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
      <PageHead icon={<InstagramIcon className="h-6 w-6" />} title={t('dashboard.instagram.title')} hint={t('dashboard.instagram.hint')} />

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {/* حلّ عملي فوري: تسجيل طلب من محادثة يدوياً — يعمل الآن بلا انتظار موافقة Meta */}
      <ManualOrderPanel />

      {status && !status.connected ? (
        <ConnectCard
          status={status}
          pendingPages={pendingPages}
          onPages={setPendingPages}
          onConnected={() => { setPendingPages(null); loadStatus(); }}
        />
      ) : status ? (
        <Inbox username={status.username} onDisconnected={loadStatus} />
      ) : null}
    </div>
  );
}

// ───────── بطاقة الربط (تسجيل دخول فيسبوك بإعادة توجيه) ─────────
function ConnectCard({ status, pendingPages, onConnected, onPages }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pages = pendingPages; // تظهر بعد العودة من فيسبوك لو عنده عدّة صفحات

  // الزرّ الأساسيّ: يفتحُ الربطَ في نافذةٍ مستقلّةٍ ومعه تذكرةٌ يعرفُ بها الخادمُ صاحبَ
  // الرحلة. وحين يعودُ صاحبُ المتجرِ إلى التطبيقِ نسألُ الخادمَ: هل تمّ؟
  const start = async (fresh = false) => {
    setError('');
    try {
      await startFbLogin({
        fresh,
        requestTicket: () => api.post('/instagram/link-token').then((r) => r.data.token).catch(() => ''),
      });
      watchReturn();
    } catch (e) { setError(getErrorMessage(e)); }
  };

  // النافذةُ المستقلّةُ لا تُخبرُنا بشيء، فنسألُ نحن عند عودةِ التطبيقِ إلى الواجهة:
  // إمّا صار مربوطاً فنُحدّث، وإمّا بقيت خطوةُ اختيارِ الصفحةِ فنعرضُها.
  const watchReturn = () => {
    const onVisible = async () => {
      if (document.hidden) return;
      try {
        const st = await api.get('/instagram/status');
        if (st.data?.connected) { document.removeEventListener('visibilitychange', onVisible); onConnected(); return; }
        const pg = await api.get('/instagram/pending-pages');
        if (pg.data?.pages?.length) { document.removeEventListener('visibilitychange', onVisible); onPages(pg.data.pages); }
      } catch { /* نُعيد المحاولة عند العودة القادمة */ }
    };
    document.addEventListener('visibilitychange', onVisible);
    setTimeout(() => document.removeEventListener('visibilitychange', onVisible), 10 * 60 * 1000);
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
        <div className="space-y-3">
          {/* الزرُّ يملأُ العرضَ: كان بعرضِ نصِّه فيصطدمُ به الرابطُ الثانويُّ بجانبِه */}
          <button onClick={() => start(false)} disabled={busy} className="btn-primary w-full justify-center gap-2 !py-3">
            <InstagramIcon className="h-5 w-5" /> {t('dashboard.instagram.connectBtn')}
          </button>

          {/* البابانِ الثانويّانِ في سطرٍ واحدٍ يفصلُهما نقطة: كانا ثلاثةَ أسطرٍ متراكمةٍ
              تحت الزرِّ فبدت البطاقةُ قائمةَ روابطَ لا فعلاً واحداً واضحاً. */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px]">
            <button onClick={() => start(true)} className="font-semibold text-gold-200 underline underline-offset-2">
              {t('dashboard.instagram.otherAccount')}
            </button>
            <span aria-hidden className="text-stone-600">·</span>
            <button
              onClick={() => window.open('https://www.facebook.com/', '_blank')}
              className="text-stone-300 underline underline-offset-2"
            >
              {t('dashboard.instagram.fbLogout')}
            </button>
          </div>

          {/* الشرحُ مطويٌّ: يحتاجُه من ظهرَ له حسابُ غيرِه، ولا يحتاجُه الباقون */}
          <details className="text-center">
            <summary className="cursor-pointer list-none text-[11px] text-stone-400 underline underline-offset-2">
              {t('dashboard.instagram.whyAccount')}
            </summary>
            <p className="mt-2 text-start text-[11px] leading-relaxed text-stone-400">
              {t('dashboard.instagram.wrongAccount')}
            </p>
          </details>
        </div>
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
  const navigate = useNavigate();
  const [convs, setConvs] = useState(null);
  const [error, setError] = useState('');

  const load = () =>
    api.get('/instagram/conversations').then((r) => setConvs(r.data.conversations)).catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  const disconnect = async () => {
    try { await api.post('/instagram/disconnect'); onDisconnected(); } catch (e) { setError(getErrorMessage(e)); }
  };

  if (convs === null && !error) return <Spinner />;

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

      {(convs && convs.length === 0) ? (
        <div className="glass p-10 text-center text-stone-400">{t('dashboard.instagram.empty')}</div>
      ) : (
        <div className="space-y-2">
          {(convs || []).map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/dashboard/instagram/${c.id}`)}
              className="glass flex w-full items-center gap-3 p-3 text-start transition hover:bg-white/5"
            >
              <Avatar url={c.customer_avatar} name={c.customer_name || c.customer_username} />
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

// صورةُ الزبون كما هي عند إنستغرام. روابطُ Meta موقّعةٌ وتنتهي صلاحيّتُها، فالسقوطُ
// إلى الحرفِ الأوّل ليس حالةً نادرةً بل الحالةُ المتوقّعةُ بعد أيّام — ولذلك لا تُعرَض
// الصورةُ إلّا وخلفَها الحرفُ جاهز.
export function Avatar({ url, name, className = 'h-11 w-11' }) {
  const [broken, setBroken] = useState(false);
  const letter = (name || '؟').trim().slice(0, 1).toUpperCase();
  return (
    <span className={`bz-avatar relative flex ${className} shrink-0 items-center justify-center rounded-full font-semibold`}>
      {letter}
      {url && !broken && (
        <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full rounded-full object-cover" />
      )}
    </span>
  );
}

// تطبيعُ العربيّة للمقارنة: الهمزاتُ والتاءُ المربوطةُ والياءُ المقصورةُ تُكتَبُ
// بأشكالٍ مختلفةٍ لنفسِ الكلمة، والتشكيلُ والتطويلُ يزيدان الاختلاف. بلا هذا لا
// تُطابَقُ «عباية» بـ«عبايه» ولا «فستان» بـ«فُستان».
export function normalizeAr(s = '') {
  return String(s)
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// رقمُ الجوّالِ من كلامِ الزبون. يكتبُه الناسُ بمسافاتٍ وشرطاتٍ ومقدّماتٍ دوليّة،
// فنُجرّدُه ثمّ نلتقطُ ما يبدأُ بـ05 وعشرةُ أرقام — وهي قاعدةُ المتجرِ نفسُها.
export function findMobile(text = '') {
  const clean = String(text).replace(/[\s()\-.\u200e\u200f]/g, '');
  const m = clean.match(/(?:\+?970|00970)?(05\d{8}|5\d{8})/);
  if (!m) return '';
  return m[1].startsWith('05') ? m[1] : `0${m[1]}`;
}

function productOptions(p) {
  const colorStock = p?.colorStock && typeof p.colorStock === 'object' ? p.colorStock : {};
  const hasColorStock = Object.keys(colorStock).length > 0;
  const colors = hasColorStock
    ? Object.keys(colorStock)
    : (p?.color || '').split(',').map((s) => s.trim()).filter(Boolean);
  const sizes = (p?.size || '').split(',').map((s) => s.trim()).filter(Boolean);
  return { colorStock, hasColorStock, colors, sizes };
}
function sizesFor(p, color) {
  const { colorStock, hasColorStock, sizes } = productOptions(p);
  if (hasColorStock) return color ? Object.keys(colorStock[color] || {}) : [];
  return sizes;
}
// صورة المنتج — نفس ترتيب صفحة المنتج (imageUrl ثم أول صورة ثم بوستر الفيديو)
function productImg(p, w = 96) {
  const raw = p?.imageUrl || p?.images?.[0] || (p?.videoUrl ? cldVideoPoster(p.videoUrl) : '');
  return raw ? cldThumb(raw, w) : '';
}

// صف منتج مختار — يظهر زي بند طلب حقيقي: صورة + لون + نمرة + كمية + إجمالي السطر
function PickedRow({ item, onChange, onRemove }) {
  const { t } = useTranslation();
  const { colors, hasColorStock } = productOptions(item.product);
  const sizes = sizesFor(item.product, item.color);
  const img = productImg(item.product);
  const line = Number(item.price) * Math.max(1, item.qty);
  return (
    <div className="flex gap-2.5 rounded-xl bg-black/20 p-2.5 ring-1 ring-white/5">
      {img ? (
        <img src={img} alt="" className="h-16 w-14 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
      ) : (
        <span className="flex h-16 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5 text-stone-500"><BagIcon className="h-5 w-5" /></span>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-100">{item.name}</span>
          <button onClick={onRemove} className="-me-1 rounded-lg p-1 text-stone-400 hover:text-red-300"><TrashIcon className="h-4 w-4" /></button>
        </div>
        {(colors.length > 0 || sizes.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {colors.length > 0 && (
              <div className="min-w-[6rem] flex-1">
                <Select value={item.color} placeholder={t('dashboard.instagram.color')}
                  options={colors.map((c) => ({ value: c, label: c }))}
                  onChange={(c) => onChange({ color: c, size: hasColorStock ? '' : item.size })} />
              </div>
            )}
            {sizes.length > 0 && (
              <div className="min-w-[5rem] flex-1">
                <Select value={item.size} placeholder={t('dashboard.instagram.size')}
                  options={sizes.map((s) => ({ value: s, label: sizeLabel(s, t) }))}
                  onChange={(s) => onChange({ size: s })} />
              </div>
            )}
            <input className="input !w-14 !py-1.5 text-center" type="number" min="1" inputMode="numeric" value={item.qty}
              onChange={(e) => onChange({ qty: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
          </div>
        )}
        <div className="text-xs text-stone-400">
          {t('common.currency')}{Number(item.price).toFixed(0)}{item.qty > 1 ? ` × ${item.qty}` : ''}
          {' = '}<span className="font-display text-sm font-bold text-gold-300">{t('common.currency')}{line.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// المكوّن الموحّد لإنشاء طلب: منتجات (بألوان/نمَر) + منطقة توصيل بسعر تلقائي + بيانات الزبون.
// onSubmit يستقبل { items, customer } ويرمي خطأً عند الفشل (نعرضه هنا)؛ النجاح يتكفّل به الأب.
function OrderComposer({ defaultName = '', defaultPhone = '', hintText = '', onSubmit }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState(null);
  const [localities, setLocalities] = useState([]); // قائمة مسطّحة: كل مدينة/قرية بندٌ مستقل
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ name: defaultName, phone: defaultPhone, city: '', area: '', address: '', deliveryFee: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/products').then((r) => setProducts(r.data.products || [])).catch(() => setProducts([]));
    api.get('/stores/me').then((r) => {
      setLocalities(Array.isArray(r.data.localities) ? r.data.localities : []);
    }).catch(() => {});
  }, []);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const add = (p) => {
    if (picked.some((x) => x.id === p.id)) return;
    const { colors } = productOptions(p);
    setPicked((prev) => [...prev, { id: p.id, name: p.name, price: Number(p.price) || 0, qty: 1, size: '', color: colors.length === 1 ? colors[0] : '', product: p }]);
    setQ('');
  };
  const patchItem = (id, patch) => setPicked((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeItem = (id) => setPicked((prev) => prev.filter((x) => x.id !== id));

  // اختيار مكان من القائمة المسطّحة: المحافظة (parent) لحقل city والقرية لحقل area،
  // والأجرة تُملأ تلقائياً (نفس حساب السلة). الكتابة الحرّة تُعامل كمدينة.
  const pickCity = (name, fee, opt) => {
    const parent = opt?.parent || name;
    setF((p) => ({
      ...p,
      city: parent,
      area: parent === name ? '' : name,
      deliveryFee: fee != null && fee !== '' ? String(fee) : p.deliveryFee,
    }));
  };
  // قائمة مسطّحة: كل مدينة/قرية بندٌ مستقل بسعره
  const cityChoices = useMemo(
    () => localities.map((z) => ({ name: z.name, parent: z.parent || z.name, region: z.region || '', fee: Number(z.fee) || 0 })),
    [localities],
  );

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return (products || []).filter((p) => (p.name || '').toLowerCase().includes(term)).slice(0, 6);
  }, [q, products]);

  // منتجاتٌ سمّاها الزبونُ في محادثته: التاجرةُ قرأت الاسمَ للتوّ في الرسالة، فلا
  // معنى لأن تكتبَه ثانيةً في البحث. نطابقُ اسمَ المنتجِ على نصِّ المحادثةِ بعد
  // تطبيعِ العربيّة، ولا نعرضُ إلّا الأسماءَ الطويلةَ بما يكفي (كلمةٌ من حرفين
  // تُطابقُ كلَّ شيءٍ فتصيرُ الاقتراحاتُ ضوضاء).
  const hints = useMemo(() => {
    const txt = normalizeAr(hintText);
    if (!txt || !products) return [];
    return products
      .filter((p) => {
        const n = normalizeAr(p.name);
        return n.length >= 4 && txt.includes(n) && !picked.some((x) => x.id === p.id);
      })
      .slice(0, 4);
  }, [hintText, products, picked]);

  // المكانُ أيضاً يُذكَرُ في المحادثة: نطابقُه على قائمةِ مناطقِ المتجرِ فتُملأُ
  // الأجرةُ معه. مرّةً واحدةً فقط، ولا نلمسُ ما كتبته التاجرةُ بنفسِها.
  const cityGuessed = useRef(false);
  useEffect(() => {
    if (cityGuessed.current || f.city || !hintText || !cityChoices.length) return;
    const txt = normalizeAr(hintText);
    const hit = cityChoices.find((z) => {
      const n = normalizeAr(z.name);
      return n.length >= 3 && txt.includes(n);
    });
    if (hit) { cityGuessed.current = true; pickCity(hit.name, hit.fee, hit); }
  }, [hintText, cityChoices, f.city]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = picked.reduce((s, x) => s + x.price * Math.max(1, x.qty), 0);
  const total = subtotal + (Number(f.deliveryFee) || 0);

  const submit = async () => {
    if (!picked.length) { setError(t('dashboard.instagram.needProduct')); return; }
    if (!f.name.trim() || !f.phone.trim()) { setError(t('dashboard.instagram.needCustomer')); return; }
    // نفس قاعدة المتجر: ١٠ أرقام تبدأ بـ 05 — أوبتيموس يرفض غيرها
    if (!isValidMobile(f.phone)) { setError(t('co.phoneInvalid')); return; }
    setBusy(true); setError('');
    try {
      await onSubmit({
        items: picked.map((x) => ({ id: x.id, qty: x.qty, size: x.size, color: x.color })),
        customer: { name: f.name, phone: f.phone, city: f.city, area: f.area, address: f.address, deliveryFee: f.deliveryFee, notes: f.notes },
      });
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* منتجاتٌ ذُكرت في المحادثة — ضغطةٌ واحدةٌ بدل بحثٍ عن اسمٍ قرأته للتوّ */}
      {hints.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gold-200">{t('dashboard.instagram.mentioned')}</span>
          {hints.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-2.5 py-1 text-xs font-semibold text-gold-100 transition hover:bg-gold-400/20"
            >
              <PlusIcon className="h-3.5 w-3.5" /> {p.name}
            </button>
          ))}
        </div>
      )}

      {/* بحث المنتجات — قائمة نهارية بيضاء متناسقة مع باقي الدشبورد */}
      <div className="relative">
        <input className="input" placeholder={t('dashboard.instagram.searchProduct')} value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-wine/15 bg-white p-1.5 shadow-2xl">
            {results.map((p) => {
              const img = productImg(p);
              return (
                <button key={p.id} onClick={() => add(p)} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-start text-sm text-[#2b2b2b] transition hover:bg-wine/5">
                  {img ? <img src={img} alt="" className="h-9 w-9 rounded-lg object-cover ring-1 ring-black/5" /> : <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-wine/5 text-wine/50"><BagIcon className="h-4 w-4" /></span>}
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span className="shrink-0 font-semibold text-wine">{t('common.currency')}{Number(p.price).toFixed(0)}</span>
                  <PlusIcon className="h-4 w-4 shrink-0 text-wine" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {picked.map((x) => (
        <PickedRow key={x.id} item={x} onChange={(patch) => patchItem(x.id, patch)} onRemove={() => removeItem(x.id)} />
      ))}

      {/* بيانات الزبون */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className="input" placeholder={t('dashboard.instagram.custName')} value={f.name} onChange={set('name')} />
        <input
          className="input" placeholder={t('co.phonePlaceholder')} value={f.phone} dir="ltr"
          inputMode="numeric" maxLength={10}
          onChange={(e) => setF((prev) => ({ ...prev, phone: sanitizeMobileInput(e.target.value) }))}
        />
        {/* التوصيل: بحث مسطّح عن المكان (كل مدينة/قرية بندٌ مستقل بسعره) + السعر بجنبه */}
        <div className="flex gap-2 sm:col-span-2">
          <div className="flex-1">
            {cityChoices.length > 0 ? (
              <CitySearch
                value={f.area || f.city}
                options={cityChoices}
                onPick={pickCity}
                onText={(txt) => setF((p) => ({ ...p, city: txt, area: '' }))}
                onClear={() => setF((p) => ({ ...p, city: '', area: '' }))}
              />
            ) : (
              <input className="input w-full" placeholder={t('dashboard.ordersSection.deliveryTo')} value={f.city} onChange={set('city')} />
            )}
          </div>
          <div className="relative w-28 shrink-0">
            <input className="input w-full pe-6 text-center" type="number" min="0" step="0.5" inputMode="decimal" placeholder={t('dashboard.ordersSection.delivery')} value={f.deliveryFee} onChange={set('deliveryFee')} />
            <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-stone-400">{t('common.currency')}</span>
          </div>
        </div>
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

// ───────── نموذج تحويل المحادثة لطلب (يستعمل المكوّن الموحّد) ─────────
export function ConvertForm({ convId, defaultName, defaultPhone = '', hintText = '', onDone }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 border-b border-white/5 bg-gold-400/5 p-3">
      <p className="text-xs font-semibold text-gold-200">{t('dashboard.instagram.convertTitle')}</p>
      <OrderComposer
        defaultName={defaultName}
        defaultPhone={defaultPhone}
        hintText={hintText}
        onSubmit={async (payload) => {
          const res = await api.post(`/instagram/conversations/${convId}/convert`, payload);
          try { window.dispatchEvent(new Event('bz:orders-changed')); } catch { /* تجاهل */ }
          onDone(res.data.orderId);
        }}
      />
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
      {/* عنوانٌ وزرٌّ في سطرٍ واحد، والشرحُ الطويلُ تحتَهما مطويّاً. كان الشرحُ خمسةَ
          أسطرٍ تحشو البطاقةَ فوقَ الزرِّ فيضيعُ الفعلُ بين الكلام. */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span className="dash-ico flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
            <BagIcon className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 font-display text-base font-bold text-gold-200">
            {t('dashboard.instagram.manualTitle')}
          </p>
          <button
            onClick={() => { setOpen((v) => !v); setDone(null); }}
            className="btn-primary shrink-0 gap-1 !px-3 !py-1.5 text-xs"
          >
            <PlusIcon className="h-4 w-4" /> {open ? t('common.cancel') : t('dashboard.instagram.newOrder')}
          </button>
        </div>
        <details className="group mt-2 ps-[3.25rem]">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-stone-400 transition hover:text-gold-200">
            {t('dashboard.instagram.whyManual')}
          </summary>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{t('dashboard.instagram.manualNote')}</p>
        </details>
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

// يستعمل المكوّن الموحّد، لكنه ينشئ طلباً مباشرةً عبر /orders/cod (بلا محادثة مربوطة)
function ManualOrderForm({ onDone }) {
  return (
    <div className="border-t border-white/5 bg-gold-400/5 p-3">
      <OrderComposer
        onSubmit={async (payload) => {
          const res = await api.post('/orders/cod', payload);
          try { window.dispatchEvent(new Event('bz:orders-changed')); } catch { /* تجاهل */ }
          onDone(res.data.reference || '');
        }}
      />
    </div>
  );
}
