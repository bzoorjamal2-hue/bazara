import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import useScrollLock from '../hooks/useScrollLock.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { buildWhatsappLink } from '../utils/whatsapp.js';
import CloseButton from './CloseButton.jsx';
import { GiftIcon, ShareIcon, WhatsAppIcon } from './icons.jsx';

// نافذة "شاركي واربحي" — الزبونة تُنشئ رابط إحالتها الخاص وتشاركه.
// مستقلّة الألوان (بورتال خارج theme-pub) فنتحكّم بالوضعين عبر sc-* في index.css.
export default function ShareEarnModal({ store, onClose }) {
  const { t } = useTranslation();
  const { dark } = useTheme();
  const percent = Number(store?.referralPercent) || 0;
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  useScrollLock(true);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !phone.trim()) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/public/referral', { store: store.slug, phone: phone.trim(), name: name.trim() });
      // رابط /share/ يعرض شعار المتجر بمعاينة واتساب ثم يحوّل لصفحة المتجر (مع الإحالة)
      setLink(`${origin}/share/store/${store.slug}?ref=${data.referral.code}`);
    } catch (err) {
      setError(getErrorMessage(err, t('referral.disabled')));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const waShare = () => {
    const msg = t('referral.shareMsg', { store: store.name, link });
    window.open(buildWhatsappLink('', msg), '_blank');
  };
  // واجهة المشاركة الأصلية (تختاري أي تطبيق) — وإلا نسخ الرابط
  const nativeShare = async () => {
    const msg = t('referral.shareMsg', { store: store.name, link });
    if (navigator.share) {
      try { await navigator.share({ title: store.name, text: msg, url: link }); return; } catch { /* أُلغيت */ }
    }
    copy();
  };

  return createPortal(
    <div className={`sc fixed inset-0 z-[85] flex items-end justify-center ${dark ? 'sc-dark' : ''}`} role="dialog" aria-modal="true" aria-label={t('referral.shareTitle')}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="sc-panel relative mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:mb-4 sm:rounded-3xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-gold-400/25 bg-gradient-to-l from-wine to-[#7a2540] px-4 py-3 text-cream">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-300/20 text-gold-200 ring-1 ring-gold-300/40" aria-hidden="true"><GiftIcon className="h-5 w-5" /></span>
          <p className="min-w-0 flex-1 truncate font-display text-base font-bold">{t('referral.shareTitle')}</p>
          <CloseButton variant="cream" size="h-10 w-10" onClick={onClose} />
        </header>

        <div className="space-y-4 p-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
          <p className="sc-muted text-sm leading-relaxed">{t('referral.shareDesc', { percent })}</p>

          {!link ? (
            <form onSubmit={submit} className="space-y-3">
              <input
                className="sc-input w-full rounded-2xl border px-4 py-2.5 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-300/40"
                dir="ltr" inputMode="tel" placeholder={t('referral.yourPhone')}
                value={phone} onChange={(e) => setPhone(e.target.value)}
              />
              <input
                className="sc-input w-full rounded-2xl border px-4 py-2.5 outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-300/40"
                placeholder={t('referral.yourName')}
                value={name} onChange={(e) => setName(e.target.value)}
              />
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
              <button type="submit" disabled={busy || !phone.trim()} className="w-full rounded-2xl bg-wine py-3 font-bold text-cream shadow-md transition hover:bg-[#7a2540] disabled:opacity-50">
                {busy ? '…' : t('referral.getLink')}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="sc-muted mb-1 text-xs font-semibold">{t('referral.yourLink')}</p>
                <div className="sc-input flex items-center gap-2 rounded-2xl border px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm" dir="ltr">{link}</span>
                  <button type="button" onClick={copy} className="shrink-0 rounded-lg bg-wine px-3 py-1 text-xs font-bold text-cream">
                    {copied ? t('referral.copied') : t('referral.copy')}
                  </button>
                </div>
              </div>
              <button type="button" onClick={nativeShare} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-wine py-3 font-bold text-cream shadow-md transition hover:bg-[#7a2540]">
                <ShareIcon className="h-5 w-5" /> {t('referral.shareNow')}
              </button>
              <button type="button" onClick={waShare} className="btn-whatsapp w-full gap-2"><WhatsAppIcon className="h-5 w-5" /> {t('referral.shareWhatsapp')}</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
