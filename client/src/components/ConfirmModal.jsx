import { useTranslation } from 'react-i18next';
import useScrollLock from '../hooks/useScrollLock.js';

// نافذة تأكيد أنيقة (بديلة عن window.confirm) — تُغلق بالضغط خارجها (يُلغي)
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  danger = true,
}) {
  const { t } = useTranslation();
  useScrollLock(open);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !busy && onCancel?.()} />
      <div className="animate-fade-up relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${danger ? 'bg-red-50 text-red-500' : 'bg-wine/10 text-wine'}`}>
          {danger ? (
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
            </svg>
          ) : (
            <span className="text-3xl">❓</span>
          )}
        </div>

        <h3 className="font-display text-xl font-bold text-[#2b2b2b]">{title || t('common.confirmTitle')}</h3>
        {message && <p className="mt-2 text-sm leading-relaxed text-[#6b6b6b]">{message}</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-wine/25 py-2.5 font-semibold text-wine transition hover:bg-wine/5 disabled:opacity-50"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-xl py-2.5 font-semibold text-white shadow-sm transition disabled:opacity-50 ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-wine hover:bg-wine-dark'
            }`}
          >
            {busy ? t('common.loading') : confirmLabel || t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
