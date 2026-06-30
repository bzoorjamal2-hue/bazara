import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { HourglassIcon, WarnIcon, CheckIcon } from './icons.jsx';

// يعرض حالة الاشتراك: فعّال / سينتهي خلال 3 أيام / منتهٍ / وضع تجريبي
export default function SubscriptionBanner() {
  const { t } = useTranslation();
  const { subscription } = useAuth();
  if (!subscription) return null;

  const { active, daysRemaining, status, currentPeriodEnd, isAdmin, pending } = subscription;
  const dateStr = currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : '';

  // المدير لا يحتاج اشتراكاً
  if (isAdmin) return null;

  // طلب قيد المراجعة
  if (!active && pending) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-orange-400/40 bg-orange-500/10 p-4 text-sm font-medium text-orange-700">
        <HourglassIcon className="h-4 w-4 shrink-0" /> {t('subscription.pendingBanner')}
      </div>
    );
  }

  // منتهٍ / غير مشترك
  if (!active && status !== 'active') {
    return (
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-red-400/40 bg-red-500/10 p-4 sm:flex-row sm:items-center">
        <p className="flex items-center gap-1.5 text-sm font-medium text-red-700"><WarnIcon className="h-4 w-4 shrink-0" /> {t('subscription.expired')}</p>
        <Link to="/subscribe" className="btn-primary !py-2 text-sm">{t('subscription.renew')}</Link>
      </div>
    );
  }

  // سينتهي خلال 3 أيام
  if (active && daysRemaining != null && daysRemaining <= 3) {
    return (
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-orange-400/40 bg-orange-500/10 p-4 sm:flex-row sm:items-center">
        <p className="flex items-center gap-1.5 text-sm font-medium text-orange-700">
          <HourglassIcon className="h-4 w-4 shrink-0" /> {t('subscription.expiringSoon')} ({t('subscription.daysLeft', { count: daysRemaining })})
        </p>
        <Link to="/subscribe" className="btn-primary !py-2 text-sm">{t('subscription.renew')}</Link>
      </div>
    );
  }

  // فعّال
  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm">
        <CheckIcon className="h-4 w-4 shrink-0 text-emerald-700" />
        <span className="font-semibold text-emerald-700">{t('subscription.active')}</span>
        {dateStr && (
          <span className="text-emerald-600">— {t('subscription.expiresOn')} <span dir="ltr">{dateStr}</span></span>
        )}
      </div>
    );
  }

  return null;
}
