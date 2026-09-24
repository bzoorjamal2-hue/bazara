import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';

// تطبيق ميتا المخصّص للدخول («Bazara Login») — غير تطبيق إنستغرام، ذاك نوعه
// Business ولا يقبل الدخول العاديّ. المعرّف عامّ بطبعه.
const APP_ID = import.meta.env.VITE_FB_LOGIN_APP_ID || '1070136699145310';

let loader;
function loadSdk() {
  if (window.FB) return Promise.resolve();
  loader ||= new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId: APP_ID, cookie: false, xfbml: false, version: 'v23.0' });
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onerror = () => { loader = null; reject(new Error('fb sdk')); };
    document.head.appendChild(s);
  });
  return loader;
}

function FbLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

// زرّ «المتابعة بفيسبوك». الـSDK يُحمَّل مسبقاً لأنّ FB.login يفتح نافذة، والمتصفّح
// لا يسمح بها إلّا داخل الضغطة نفسها — أيّ انتظارٍ قبلها يجعلها تُحجَب.
// داخل التطبيق الأصليّ لا نظهره، كزرّ جوجل.
export default function FacebookButton({ onToken, disabled }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    if (native) return undefined;
    let alive = true;
    loadSdk().then(() => alive && setReady(true)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [native]);

  if (native || failed) return null;

  const click = () => {
    if (!window.FB) return;
    window.FB.login(
      (r) => { if (r.authResponse?.accessToken) onToken(r.authResponse.accessToken); },
      { scope: 'public_profile,email', auth_type: 'rerequest' }
    );
  };

  return (
    <button
      type="button"
      onClick={click}
      disabled={!ready || disabled}
      className="mx-auto flex h-10 w-full max-w-[400px] items-center justify-center gap-2.5 rounded-full bg-[#1877F2] px-5 text-sm font-medium text-white transition hover:bg-[#166FE5] disabled:opacity-60"
    >
      <FbLogo />
      {t('auth.continueFacebook')}
    </button>
  );
}
