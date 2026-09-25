import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';

// الـClient ID عامّ بطبعه (يظهر بكود الصفحة)؛ السرّ لا يلزمنا أصلاً.
const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || '413501449549-6dsq0efb225kvkt8i1huq0qub61e5jk8.apps.googleusercontent.com';
const SRC = 'https://accounts.google.com/gsi/client';

let loader;
function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  loader ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { loader = null; reject(new Error('gsi')); };
    document.head.appendChild(s);
  });
  return loader;
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// زرّ «المتابعة بجوجل».
//
// كان زرّ جوجل الرسميّ وحده: جوجل ترسمه بعد تحميل سكربتها من الشبكة — فالمكان فارغٌ
// حتى يصل، ثمّ يظهر، ثمّ يُعاد رسمه مع كلّ تبديل للوضع الليليّ أو اللغة، ويختفي كلّه
// حين يُحجب السكربت (متصفّح إنستغرام، مانع إعلانات). «بتضل معلقة تبين وتختفي».
//
// الآن زرّنا نحن ظاهرٌ من أوّل رسمة، بشكل زرّ فيسبوك وحجمه، ولا يتغيّر أبداً. زرّ جوجل
// الرسميّ يُرسم فوقه شفّافاً (opacity .01) بالمقاس نفسه، فالضغطة تصل جوجل كما كانت
// (نافذتها أو FedCM) ويعود التوكن الموقّع نفسه للخادم. وإن لم يصل السكربت تبقى
// الواجهة كما هي، والضغطة تقول ذلك بدل أن يختفي الزرّ.
// داخل التطبيق الأصليّ لا نظهره: جوجل تحجب الدخول من WebView (disallowed_useragent).
export default function GoogleButton({ onCredential, text = 'continue_with' }) {
  const { t, i18n } = useTranslation();
  const wrap = useRef(null);
  const slot = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    if (native) return undefined;
    let alive = true;
    loadGsi()
      .then(() => {
        if (!alive || !slot.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (r) => cb.current?.(r.credential),
          ux_mode: 'popup',
          use_fedcm_for_button: true,
        });
        slot.current.innerHTML = '';
        window.google.accounts.id.renderButton(slot.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          locale: i18n.language === 'en' ? 'en' : 'ar',
          width: Math.min(wrap.current?.offsetWidth || 360, 400),
        });
        setReady(true);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
    // الوضع الليليّ لا يُعيد الرسم: الزرّ الرسميّ شفّافٌ أصلاً
  }, [native, i18n.language, text]);

  if (native) return null;

  return (
    <div ref={wrap} className="group relative mx-auto h-10 w-full max-w-[400px]">
      <button
        type="button"
        tabIndex={ready ? -1 : 0}
        // ضغطةٌ على حافّة زرّنا خارج زرّ جوجل الشفّاف (أضيق منه أحياناً): نافذة جوجل نفسها
        onClick={() => {
          if (failed) window.alert(t('auth.googleUnavailable'));
          else if (ready) window.google?.accounts?.id?.prompt();
        }}
        className="bz-gbtn flex h-10 w-full items-center justify-center gap-2.5 rounded-full px-5 text-sm font-medium transition"
      >
        <GoogleLogo />
        {t('auth.continueGoogle')}
      </button>
      {/* زرّ جوجل الرسميّ فوق زرّنا، شفّافاً — يلتقط الضغطة وحده */}
      <div
        ref={slot}
        aria-hidden={!ready}
        className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full"
        style={{ opacity: 0.01 }}
      />
    </div>
  );
}
