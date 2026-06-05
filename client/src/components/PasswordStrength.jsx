import { useTranslation } from 'react-i18next';

// يحسب قوة كلمة المرور ويعرض شريطاً ملوّناً + وصفاً
export function scorePassword(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4); // 0..4
}

export default function PasswordStrength({ password }) {
  const { t } = useTranslation();
  if (!password) return null;

  const score = scorePassword(password);
  const levels = [
    { w: '25%', color: 'bg-red-500', text: t('password.weak'), tc: 'text-red-300' },
    { w: '50%', color: 'bg-orange-500', text: t('password.medium'), tc: 'text-orange-300' },
    { w: '75%', color: 'bg-yellow-400', text: t('password.strong'), tc: 'text-yellow-300' },
    { w: '100%', color: 'bg-emerald-500', text: t('password.veryStrong'), tc: 'text-emerald-300' },
  ];
  const lvl = levels[Math.max(0, score - 1)];

  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
        <div className={`h-full rounded-full transition-all duration-300 ${lvl.color}`} style={{ width: lvl.w }} />
      </div>
      <p className={`mt-1 text-xs font-medium ${lvl.tc}`}>{lvl.text}</p>
    </div>
  );
}
