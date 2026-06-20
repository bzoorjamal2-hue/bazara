import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import useScrollLock from '../hooks/useScrollLock.js';
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

export default function StylistChat({ store, whatsapp = '' }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language !== 'en';
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(false); // أُطفئت الميزة على الخادم (لا مفتاح)
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]); // {role, content, products?}
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useScrollLock(open);

  // تمرير لأسفل عند كل رسالة جديدة أو أثناء التفكير
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy, open]);

  if (disabled || !store?.slug) return null;

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setError('');
    setInput('');
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setBusy(true);
    try {
      const payload = next.map((m) => ({ role: m.role, content: m.content }));
      const { data } = await api.post('/public/assistant', { store: store.slug, messages: payload });
      setMessages((cur) => [...cur, { role: 'assistant', content: data.reply, products: data.products || [] }]);
    } catch (e) {
      if (e?.response?.status === 503 && e.response.data?.disabled) {
        setDisabled(true); // أُطفئت — نخفي الميزة بهدوء
        setOpen(false);
        return;
      }
      setError(getErrorMessage(e, t('assistant.error')));
    } finally {
      setBusy(false);
    }
  };

  const chips = ['occasion', 'everyday', 'gift', 'trending'];

  return (
    <>
      {/* الزر العائم — على الجهة المقابلة للواتساب كي لا يتداخلا */}
      <div
        className="fixed start-5 z-40 h-14 w-14 fab-float"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
      >
        {/* هالة ذهبية ناعمة تتنفّس خلف الزر */}
        <span className="fab-aura pointer-events-none absolute -inset-1.5 rounded-full bg-gold-300 blur-lg" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('assistant.fab')}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full text-wine ring-1 ring-white/40 transition-all duration-300 hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(150deg,#f9ecc4,#e3b94f)', boxShadow: '0 10px 26px -8px rgba(201,162,77,0.8)' }}
        >
          <SparkleIcon className="relative h-7 w-7 transition-transform duration-500 group-hover:rotate-[18deg] group-hover:scale-110" />
        </button>
      </div>

      {open && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={t('assistant.title')}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />

          <div className="relative mx-auto flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-cream shadow-2xl sm:mb-4 sm:rounded-3xl">
            {/* رأس أنيق: أيقونة ذهبية + عنوان + إغلاق */}
            <header className="flex shrink-0 items-center gap-3 border-b border-gold-400/25 bg-gradient-to-l from-wine to-[#7a2540] px-4 py-3 text-cream">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-300/20 text-gold-200 ring-1 ring-gold-300/40">
                <SparkleIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-bold leading-tight">{t('assistant.title')}</p>
                <p className="truncate text-xs text-cream/70">{t('assistant.subtitle')}</p>
              </div>
              <CloseButton variant="cream" size="h-10 w-10" onClick={() => setOpen(false)} />
            </header>

            {/* منطقة الرسائل */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4">
              {/* ترحيب دائم بأعلى المحادثة */}
              <Bubble role="assistant">{t('assistant.greeting')}</Bubble>

              {messages.map((m, i) => (
                <div key={i} className="space-y-3">
                  <Bubble role={m.role}>{m.content}</Bubble>
                  {m.role === 'assistant' && m.products && m.products.length > 0 && (
                    <div>
                      <p className="mb-2 px-1 text-xs font-semibold text-wine/70">{t('assistant.suggestions')}</p>
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
                <div className="flex items-center gap-2 px-1 text-sm text-wine/70">
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
                      className="rounded-full border border-wine/25 bg-white/70 px-3.5 py-1.5 text-sm text-wine transition hover:bg-wine hover:text-cream"
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
              className="flex shrink-0 items-center gap-2 border-t border-wine/10 bg-cream px-3 py-3"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('assistant.placeholder')}
                className="min-w-0 flex-1 rounded-full border border-wine/20 bg-white px-4 py-2.5 text-wine outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-300/40"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label={t('assistant.send')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wine text-cream shadow-md transition hover:bg-[#7a2540] disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className={`h-5 w-5 ${rtl ? 'scale-x-[-1]' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// فقاعة رسالة — الزبونة خمرية بالجهة، المساعِدة بطاقة بيضاء
function Bubble({ role, children }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-ee-md bg-wine text-cream'
            : 'rounded-es-md border border-wine/10 bg-white text-stone-700 shadow-sm'
        }`}
      >
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
