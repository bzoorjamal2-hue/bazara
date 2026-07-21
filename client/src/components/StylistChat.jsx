import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import useScrollLock from '../hooks/useScrollLock.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { resizeImageFile } from '../utils/image.js';
import CloseButton from './CloseButton.jsx';
import ProductCard from './ProductCard.jsx';

// مساعِدة التسوّق الذكية — زر عائم يفتح شاتاً يرشّح قطعاً من هذا المتجر (Claude على الخادم).
// تتبع نفس هوية البوتيك الفاخر (كريمي/خمري + ذهبي) وتتكيّف تلقائياً مع كل شاشة واللغتين.

// أيقونة لمعة/نجمة أناقة
function SparkleIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l1.6 4.7a4 4 0 0 0 2.5 2.5l4.7 1.6-4.7 1.6a4 4 0 0 0-2.5 2.5L12 20.1l-1.6-4.7a4 4 0 0 0-2.5-2.5L3.2 11.3l4.7-1.6a4 4 0 0 0 2.5-2.5z" />
      <path d="M5 3.5l.6 1.7L7.3 5.8l-1.7.6L5 8.1l-.6-1.7L2.7 5.8l1.7-.6z" opacity=".7" />
    </svg>
  );
}

// حفظ محادثة منفصلة لكل متجر (عزل تام + استرجاع فوري) — بمفتاح السلَگ
const HKEY = (slug) => `bz_stylist_${slug}`;
const MAX_SENT = 8; // آخر رسائل تُرسل للخادم (توفير توكن)
function loadHistory(slug) {
  if (!slug) return [];
  try { const r = JSON.parse(localStorage.getItem(HKEY(slug)) || '[]'); return Array.isArray(r) ? r : []; }
  catch { return []; }
}
function saveHistory(slug, msgs) {
  if (!slug) return;
  // نُسقط الصور من التخزين (كبيرة) — تبقى للعرض في الجلسة الحالية فقط
  try {
    const slim = msgs.slice(-20).map(({ image, ...m }) => m); // eslint-disable-line no-unused-vars
    localStorage.setItem(HKEY(slug), JSON.stringify(slim));
  } catch { /* تجاوز الحصّة */ }
}

export default function StylistChat({ store, whatsapp = '', marketplace = false }) {
  const { t, i18n } = useTranslation();
  const { dark } = useTheme();
  const rtl = i18n.language !== 'en';
  // مفتاح المحادثة: السوق العام له مفتاح ثابت، والمتجر له سلَگه (عزل تام)
  const convKey = marketplace ? '__market' : store?.slug;
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(false); // أُطفئت الميزة على الخادم (نادر)
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState(() => loadHistory(convKey)); // {role, content, products?, image?}
  const [pendingImage, setPendingImage] = useState(''); // صورة مختارة للبحث بالصورة
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const slugRef = useRef(convKey);

  useScrollLock(open);

  // تبديل المتجر/السوق → نحمّل المحادثة الصحيحة (لا تشابك بين السياقات)
  useEffect(() => {
    slugRef.current = convKey;
    setMessages(loadHistory(convKey));
    setError(''); setInput('');
  }, [convKey]);

  // تمرير لأسفل عند كل رسالة جديدة أو أثناء التفكير
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy, open]);

  if (disabled || !convKey) return null;

  const send = async (text, imgArg) => {
    const key = convKey; // نثبّت السياق الحالي (متجر/سوق) لهذا الطلب
    const img = imgArg ?? pendingImage;
    const content = (text ?? input).trim();
    if ((!content && !img) || busy) return;
    setError('');
    setInput('');
    setPendingImage('');
    const shownText = content || t('assistant.photoQuery');
    const next = [...messages, { role: 'user', content: shownText, image: img || undefined }];
    setMessages(next);
    saveHistory(key, next);
    setBusy(true);
    try {
      const payload = next.slice(-MAX_SENT).map((m) => ({ role: m.role, content: m.content }));
      const body = marketplace ? { marketplace: true, messages: payload } : { store: key, messages: payload };
      if (img) body.image = img;
      const { data } = await api.post('/public/assistant', body);
      if (slugRef.current !== key) return; // غادرت لسياق آخر أثناء الطلب → نتجاهل
      setMessages((cur) => {
        const m = [...cur, { role: 'assistant', content: data.reply, products: data.products || [] }];
        saveHistory(key, m);
        return m;
      });
    } catch (e) {
      if (slugRef.current !== key) return;
      if (e?.response?.status === 503 && e.response.data?.disabled) {
        setDisabled(true); setOpen(false); return;
      }
      setError(getErrorMessage(e, t('assistant.error')));
    } finally {
      if (slugRef.current === key) setBusy(false);
    }
  };

  // اختيار صورة للبحث بالصورة — تُصغَّر إلى 512px لتوفير التوكن
  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPendingImage(await resizeImageFile(file, { maxSize: 512, quality: 0.7 }));
    } catch {
      setError(t('assistant.error'));
    }
  };

  const clearChat = () => { setMessages([]); saveHistory(convKey, []); setError(''); };

  const chips = ['occasion', 'everyday', 'gift', 'trending'];

  return (
    <>
      {/* الزر العائم — على الجهة المقابلة للواتساب كي لا يتداخلا.
          ذهبي شمبانيا هادئ فخم بلا وميض/طفو، والأيقونة داكنة دائماً للتباين */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('assistant.fab')}
        // زر «العودة للأعلى» يقيس هذا العنصر ليجلس فوقه بلا تصادم — لا تُزل السمة
        data-fab="stylist"
        className="group fixed start-5 z-40 flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-white/30 transition-transform duration-300 hover:scale-110 active:scale-95"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
          background: dark ? 'linear-gradient(150deg,#d4bd80,#a8863f)' : 'linear-gradient(150deg,#f9ecc4,#e3b94f)',
          boxShadow: dark
            ? '0 10px 24px -10px rgba(168,134,63,0.55), 0 2px 6px -2px rgba(0,0,0,0.3)'
            : '0 12px 28px -10px rgba(201,162,77,0.6), 0 2px 6px -2px rgba(0,0,0,0.15)',
          color: '#3f2e22',
        }}
      >
        <SparkleIcon className="h-7 w-7 transition-transform duration-500 group-hover:rotate-[18deg]" />
      </button>

      {open && createPortal(
        <div className={`sc fixed inset-0 z-[80] flex items-end justify-center ${dark ? 'sc-dark' : ''}`} role="dialog" aria-modal="true" aria-label={t('assistant.title')}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />

          <div className="sc-panel relative mx-auto flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:mb-4 sm:rounded-3xl">
            {/* رأس أنيق: أيقونة ذهبية + عنوان + إغلاق */}
            <header className="flex shrink-0 items-center gap-3 border-b border-gold-400/25 bg-gradient-to-l from-wine to-[#7a2540] px-4 py-3 text-cream">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-300/20 text-gold-200 ring-1 ring-gold-300/40">
                <SparkleIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-bold leading-tight">{t('assistant.title')}</p>
                <p className="truncate text-xs text-cream/70">{t('assistant.subtitle')}</p>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  aria-label={t('assistant.newChat')}
                  title={t('assistant.newChat')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream/15 text-cream transition hover:bg-cream/25"
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
                  </svg>
                </button>
              )}
              <CloseButton variant="cream" size="h-10 w-10" onClick={() => setOpen(false)} />
            </header>

            {/* منطقة الرسائل */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4">
              {/* ترحيب دائم بأعلى المحادثة */}
              <Bubble role="assistant">{t('assistant.greeting')}</Bubble>

              {messages.map((m, i) => (
                <div key={i} className="space-y-3">
                  <Bubble role={m.role} image={m.image}>{m.content}</Bubble>
                  {m.role === 'assistant' && m.products && m.products.length > 0 && (
                    <div>
                      <p className="sc-muted mb-2 px-1 text-xs font-semibold">{t('assistant.suggestions')}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {m.products.map((p, j) => (
                          <ProductCard key={p.id} product={p} index={j} whatsapp={whatsapp} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {busy && (
                <div className="sc-muted flex items-center gap-2 px-1 text-sm">
                  <Dots /> {t('assistant.thinking')}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              {/* اقتراحات بدء سريعة قبل أول رسالة */}
              {messages.length === 0 && !busy && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {chips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => send(t(`assistant.chips.${c}`))}
                      className="sc-chip rounded-full border px-3.5 py-1.5 text-sm transition"
                    >
                      {t(`assistant.chips.${c}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* صف الإدخال — مثبّت أسفل اللوحة مع هامش آمن */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="sc-row flex shrink-0 flex-col gap-2 border-t px-3 py-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
            >
              {/* معاينة الصورة المختارة للبحث بالصورة */}
              {pendingImage && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <img src={pendingImage} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-gold-400/40" />
                    <button
                      type="button"
                      onClick={() => setPendingImage('')}
                      aria-label={t('image.remove')}
                      className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-wine text-cream shadow"
                    >
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                  </div>
                  <span className="sc-muted text-xs">{t('assistant.photoReady')}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} className="hidden" />
                {/* زر البحث بالصورة */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label={t('assistant.photo')}
                  title={t('assistant.photo')}
                  className="sc-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40"
                  disabled={busy}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2l1.2-1.8A1 1 0 0 1 8.5 4.7h7a1 1 0 0 1 .8.5L17.5 7h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" /><circle cx="12" cy="12.5" r="3.2" />
                  </svg>
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('assistant.placeholder')}
                  className="sc-input min-w-0 flex-1 rounded-full border px-4 py-2.5 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-300/40"
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || (!input.trim() && !pendingImage)}
                  aria-label={t('assistant.send')}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wine text-cream shadow-md transition hover:bg-[#7a2540] disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" className={`h-5 w-5 ${rtl ? 'scale-x-[-1]' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// فقاعة رسالة — الزبونة خمرية بالجهة، المساعِدة بطاقة بيضاء. تعرض صورة البحث إن وُجدت.
function Bubble({ role, image, children }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-ee-md bg-wine text-cream'
            : 'sc-bubble-ai rounded-es-md border shadow-sm'
        }`}
      >
        {image && <img src={image} alt="" className="mb-2 max-h-40 w-full rounded-lg object-cover" />}
        {children}
      </div>
    </div>
  );
}

// نقاط تحميل لطيفة
function Dots() {
  return (
    <span className="inline-flex gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/50 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/50 [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-wine/50" />
    </span>
  );
}
