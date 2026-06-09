import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const isStandalone = () =>
  (typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true));

const isIOS = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

// بطاقة "تنزيل التطبيق" — تظهر بالصفحة الرئيسية وتشغّل تثبيت PWA،
// ومع آيفون (لا يدعم التثبيت التلقائي) تعرض خطوات الإضافة للشاشة الرئيسية.
export default function InstallApp() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [iosHelp, setIosHelp] = useState(false);
  const ios = isIOS();

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // مثبّت مسبقاً، أو لا يمكن التثبيت (لا حدث تثبيت ولا آيفون) → نخفي البطاقة
  if (installed) return null;
  if (!deferred && !ios) return null;

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else if (ios) {
      setIosHelp(true);
    }
  };

  return (
    <section className="mt-10">
      <div className="glass flex flex-col items-center gap-4 overflow-hidden p-6 text-center sm:flex-row sm:text-start">
        <img src="/icon-192.png" alt="Bazara" className="h-16 w-16 shrink-0 rounded-2xl shadow-lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold text-stone-100">{t('pwa.title')}</h3>
          <p className="mt-1 text-sm text-stone-400">{t('pwa.desc')}</p>
        </div>
        <button onClick={install} className="btn-primary shrink-0 whitespace-nowrap">
          📲 {t('pwa.install')}
        </button>
      </div>

      {/* تعليمات آيفون */}
      {iosHelp && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => setIosHelp(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="animate-fade-up relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src="/icon-192.png" alt="Bazara" className="mx-auto mb-3 h-14 w-14 rounded-2xl" />
            <h3 className="font-display text-lg font-bold text-[#2b2b2b]">{t('pwa.iosTitle')}</h3>
            <ol className="mt-4 space-y-3 text-start text-sm text-[#444]">
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wine/10 font-bold text-wine">1</span>
                <span className="flex items-center gap-1">{t('pwa.iosStep1')}
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-wine" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M8 8l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wine/10 font-bold text-wine">2</span>
                <span>{t('pwa.iosStep2')}</span>
              </li>
            </ol>
            <button onClick={() => setIosHelp(false)} className="mt-6 w-full rounded-xl bg-wine py-2.5 font-semibold text-cream transition hover:bg-wine-dark">
              {t('common.ok') || 'تمام'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
