import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pushSupported, enablePush, pushStatus } from '../utils/push.js';

// بطاقة تفعيل إشعارات الطلبات على الجوال (تظهر للمشترك بنظرة عامة).
export default function PushToggle() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('off');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { pushStatus().then(setStatus); }, []);
  if (!pushSupported()) return null;

  const enable = async () => {
    setBusy(true); setMsg('');
    try {
      await enablePush();
      setStatus('on');
      setMsg('');
    } catch (e) {
      setMsg(
        e.message === 'denied' ? t('push.denied')
        : e.message === 'not-configured' ? t('push.notConfigured')
        : t('push.error')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-display text-lg font-bold text-stone-100">🔔 {t('push.title')}</p>
        <p className="mt-1 text-sm text-stone-400">{status === 'on' ? t('push.onDesc') : t('push.desc')}</p>
        {msg && <p className="mt-1 text-sm font-medium text-red-300">{msg}</p>}
      </div>
      {status === 'on' ? (
        <span className="shrink-0 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-200">✓ {t('push.on')}</span>
      ) : (
        <button onClick={enable} disabled={busy} className="btn-primary shrink-0 !py-2.5 text-sm disabled:opacity-60">
          {busy ? t('common.loading') : t('push.enable')}
        </button>
      )}
    </div>
  );
}
