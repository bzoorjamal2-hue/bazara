import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';

// تطبيق ميتا المخصّص للدخول («Bazara Login») — غير تطبيق إنستغرام، ذاك نوعه
// Business ولا يقبل الدخول العاديّ. المعرّف عامّ بطبعه.
const APP_ID = import.meta.env.VITE_FB_LOGIN_APP_ID || '1070136699145310';
const STATE_KEY = 'bz_fb_state';
// وافقت ميتا على email وpublic_profile في 25 أيلول 2026، فالزرّ ظاهرٌ للجميع.
// ‏false تخفيه مجدّداً إن احتجنا (قبل القبول لا يدخل به إلّا أصحاب الأدوار).
const FB_LOGIN_LIVE = true;

function FbLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

// زرّ «المتابعة بفيسبوك» بالتحويل لا بالنافذة المنبثقة: المتصفّحات داخل التطبيقات
// (إنستغرام وواتساب على الآيفون) تحجب النوافذ، وأدوات تسجيل الشاشة لا تلتقطها.
// نذهب إلى فيسبوك بالتبويب نفسه ونعود إلى الصفحة نفسها والتوكن في الـhash،
// ومعه state عشوائيّ نطابقه كي لا يُدسّ علينا توكنٌ من رابطٍ مصنوع.
// الصفحات التي نعود إليها مسجّلة عند ميتا (Valid OAuth Redirect URIs).
// داخل التطبيق الأصليّ لا نظهره، كزرّ جوجل.
export default function FacebookButton({ onToken, disabled }) {
  const { t } = useTranslation();
  const native = Capacitor.isNativePlatform();
  const cb = useRef(onToken);
  cb.current = onToken;

  // العودة من فيسبوك: ‎#access_token=…&state=…
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    if (!h.has('access_token') && !h.has('error')) return;
    // نمسح الـhash فوراً: التوكن لا يبقى بالرابط ولا بالسجلّ
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    let expected = '';
    try { expected = sessionStorage.getItem(STATE_KEY) || ''; sessionStorage.removeItem(STATE_KEY); } catch { /* تصفّح خاص */ }
    const token = h.get('access_token');
    if (token && expected && h.get('state') === expected) cb.current?.(token);
  }, []);

  if (native || !FB_LOGIN_LIVE) return null;

  const click = () => {
    const state = crypto.getRandomValues(new Uint32Array(4)).join('');
    try { sessionStorage.setItem(STATE_KEY, state); } catch { /* تصفّح خاص */ }
    const p = new URLSearchParams({
      client_id: APP_ID,
      redirect_uri: `${window.location.origin}${window.location.pathname}`,
      response_type: 'token',
      scope: 'public_profile,email',
      state,
    });
    window.location.href = `https://www.facebook.com/v23.0/dialog/oauth?${p}`;
  };

  return (
    <button
      type="button"
      onClick={click}
      disabled={disabled}
      className="mx-auto flex h-10 w-full max-w-[400px] items-center justify-center gap-2.5 rounded-full bg-[#1877F2] px-5 text-sm font-medium text-white transition hover:bg-[#166FE5] disabled:opacity-60"
    >
      <FbLogo />
      {t('auth.continueFacebook')}
    </button>
  );
}
