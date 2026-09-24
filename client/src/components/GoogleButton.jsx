import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { useTheme } from '../context/ThemeContext.jsx';

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

// زرّ «المتابعة بجوجل» الرسميّ. جوجل ترسمه بنفسها (شروطها للعلامة)، ونحن نأخذ
// منه توكناً موقّعاً نسلّمه للخادم. داخل التطبيق الأصليّ لا نظهره: جوجل تحجب
// الدخول من WebView بخطأ disallowed_useragent.
export default function GoogleButton({ onCredential, text = 'continue_with' }) {
  const { i18n } = useTranslation();
  const { dark } = useTheme();
  const box = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return undefined;
    let alive = true;
    loadGsi()
      .then(() => {
        if (!alive || !box.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (r) => cb.current?.(r.credential),
          ux_mode: 'popup',
          use_fedcm_for_button: true,
        });
        box.current.innerHTML = '';
        window.google.accounts.id.renderButton(box.current, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          locale: i18n.language === 'en' ? 'en' : 'ar',
          width: Math.min(box.current.offsetWidth || 360, 400),
        });
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [dark, i18n.language, text]);

  if (Capacitor.isNativePlatform() || failed) return null;
  return <div ref={box} className="flex min-h-[44px] w-full justify-center" />;
}
