import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { storeFollowSupported, isFollowingStore, followStore, unfollowStore } from '../utils/push.js';
import { BellIcon, CheckIcon } from './icons.jsx';

// زر "فعّلي إشعارات المتجر" داخل درج المتجر — يشترك الزائر (حتى بلا حساب) بإشعارات
// المتجر (Web Push) فيصله وصول الجديد/الخصومات. يظهر فقط على الويب/PWA حيث الاشتراك
// يُربط بالمتجر. عند الرفض/عدم الدعم لا نُظهر شيئاً كي لا نُربك الزبونة.
export default function StoreFollowButton({ slug, onDone }) {
  const { t } = useTranslation();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(!storeFollowSupported());

  useEffect(() => { setOn(isFollowingStore(slug)); }, [slug]);

  if (hidden) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) { await unfollowStore(slug); setOn(false); }
      else { await followStore(slug); setOn(true); onDone?.(); }
    } catch (e) {
      // الإذن مرفوض/غير مهيّأ → نخفي الزر بهدوء
      if (String(e?.message) === 'denied' || String(e?.message) === 'not-configured' || String(e?.message) === 'unsupported') setHidden(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-start text-base font-bold transition disabled:opacity-60 ${
        on ? 'border-cream/40 bg-cream/20 text-cream' : 'border-cream/25 bg-cream/10 text-cream hover:bg-cream/20'
      }`}
    >
      {on ? <CheckIcon className="h-5 w-5 shrink-0" /> : <BellIcon className="h-5 w-5 shrink-0" />}
      {busy ? t('common.loading') : on ? t('storeFollow.following') : t('storeFollow.follow')}
    </button>
  );
}
