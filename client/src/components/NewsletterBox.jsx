import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../api/client.js';
import { MailIcon } from './icons.jsx';

// نشرة بازارا — حقل واحد يقبل بريداً أو رقم واتساب (الخادم يكتشف النوع).
// عمداً بلا حقل اسم: كل حقل إضافي يقلّل الاشتراك، والاسم لا يلزمنا لإرسال عرض.
// وبعد النجاح نُبقي الرسالة فقط ولا نُعيد إظهار النموذج — فلا تشترك مرّتين بالخطأ.
export default function NewsletterBox() {
  const { t } = useTranslation();
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const v = contact.trim();
    if (!v || busy) return;
    setBusy(true); setErr('');
    try {
      await api.post('/public/subscribe', { contact: v });
      setDone(true);
    } catch (ex) {
      setErr(getErrorMessage(ex, t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass relative mt-16 overflow-hidden p-8 text-center sm:mt-20">
      <span className="dash-hairline absolute inset-x-0 top-0" />
      {/* توهّجان ذهبيان ناعمان بالخلفية يعطيان عمقاً افتتاحياً راقياً */}
      <span aria-hidden className="pointer-events-none absolute -top-16 start-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-gold-400/15 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-20 end-0 h-40 w-40 rounded-full bg-wine/10 blur-3xl" />
      <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-wine/12 to-gold-400/15 text-wine ring-1 ring-gold-400/40">
        <MailIcon className="h-7 w-7" />
      </span>
      <h2 className="relative mt-4 font-display text-xl font-bold text-wine sm:text-2xl">{t('newsletter.title')}</h2>
      <p className="relative mx-auto mt-2 max-w-md text-sm text-stone-400">{t('newsletter.desc')}</p>

      {done ? (
        <p className="relative mt-5 font-bold text-emerald-600">{t('newsletter.thanks')}</p>
      ) : (
        <form onSubmit={submit} className="relative mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row">
          <input
            value={contact}
            onChange={(e) => { setContact(e.target.value); if (err) setErr(''); }}
            placeholder={t('newsletter.placeholder')}
            autoComplete="email"
            dir="ltr"
            className={`input flex-1 text-center sm:text-start ${err ? 'ring-1 ring-red-400/70' : ''}`}
          />
          <button
            type="submit"
            disabled={busy || !contact.trim()}
            className="shrink-0 rounded-full px-7 py-3 font-bold text-cream ring-1 ring-[#e6c878]/35 transition hover:brightness-110 disabled:opacity-50"
            style={{ background: 'linear-gradient(150deg, #3f2e22 0%, #2b1d12 60%, #1c1309 100%)' }}
          >
            {busy ? t('common.loading') : t('newsletter.cta')}
          </button>
        </form>
      )}
      {err && <p className="mt-2 text-sm font-medium text-red-500">{err}</p>}
      {!done && <p className="mt-3 text-[11px] text-stone-500">{t('newsletter.privacy')}</p>}
    </section>
  );
}
