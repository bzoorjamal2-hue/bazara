import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import { PageHead, SectionHead, Field, Tip } from '../../components/FormField.jsx';
import { GearIcon, CardIcon, LockOpenIcon, MailIcon, CheckIcon, WarnIcon } from '../../components/icons.jsx';

// كلمة سرّ مؤقّتة قويّة — للمسار اليدويّ وحده، وبأحرف لا تلتبس (بلا l/1/O/0)
function genPassword() {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const dig = '23456789';
  const sym = '!@#$%&*';
  const all = lower + upper + dig + sym;
  const pick = (str) => str[Math.floor(Math.random() * str.length)];
  let out = pick(lower) + pick(upper) + pick(dig) + pick(sym);
  for (let i = 0; i < 6; i++) out += pick(all);
  return out.split('').sort(() => Math.random() - 0.5).join('');
}

// إعدادات المنصّة — ما يخصّ الموقع كلّه لا متجراً بعينه. فُصلت عن تبويب
// الاشتراكات الذي كان يجمع أربع أدوات لا رابط بينها.
export default function AdminSettings() {
  const { t } = useTranslation();

  const [payInfo, setPayInfo] = useState('');
  const [payMsg, setPayMsg] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [manual, setManual] = useState(false);      // المسار اليدويّ مطويّ عمداً
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api.get('/subscription/settings').then((r) => setPayInfo(r.data.paymentInfo || '')).catch(() => {});
  }, []);

  const savePayment = async (e) => {
    e.preventDefault();
    setPayBusy(true); setPayMsg('');
    try {
      await api.put('/subscription/settings', { paymentInfo: payInfo });
      setPayMsg(t('admin.paymentSaved'));
      setTimeout(() => setPayMsg(''), 3000);
    } catch (e2) {
      setErr(getErrorMessage(e2, t('errors.generic')));
    } finally {
      setPayBusy(false);
    }
  };

  // الطريق الآمن: الرمز يصل لبريدها هي، فلا أحد يرى كلمة السرّ
  const sendReset = async () => {
    if (!email.trim()) return;
    setBusy('send'); setMsg(''); setErr('');
    try {
      await api.post('/auth/admin/send-reset', { email: email.trim() });
      setMsg(t('admin.resetSent', { email: email.trim() }));
    } catch (e2) {
      setErr(getErrorMessage(e2, t('errors.generic')));
    } finally {
      setBusy('');
    }
  };

  const setDirectly = async (e) => {
    e.preventDefault();
    setBusy('manual'); setMsg(''); setErr('');
    try {
      await api.post('/auth/admin/reset-password', { email: email.trim(), newPassword });
      setMsg(t('admin.resetDone'));
    } catch (e2) {
      setErr(getErrorMessage(e2, t('errors.generic')));
    } finally {
      setBusy('');
    }
  };

  const CARD = 'dash-section glass space-y-4 p-5';

  return (
    <div className="space-y-5">
      <PageHead icon={<GearIcon className="h-6 w-6" />} title={t('admin.settingsTitle')} hint={t('admin.settingsHint')} />

      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
          <CheckIcon className="h-4 w-4 shrink-0" /> {msg}
        </div>
      )}
      {err && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{err}</div>}

      {/* تعليمات الدفع — تظهر لصاحبات المتاجر عند طلب الاشتراك */}
      <form onSubmit={savePayment} className={CARD}>
        <SectionHead icon={<CardIcon className="h-5 w-5" />} title={t('admin.paymentTitle')} desc={t('admin.paymentHint')} />
        {payMsg && (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
            <CheckIcon className="h-3.5 w-3.5 shrink-0" /> {payMsg}
          </p>
        )}
        <Field label={t('admin.paymentTitle')} tip={t('admin.paymentTip')} max={600} value={payInfo}>
          <textarea
            rows={4} maxLength={600} className="input resize-none"
            value={payInfo} onChange={(e) => setPayInfo(e.target.value)}
            placeholder={t('admin.paymentPlaceholder')}
          />
        </Field>
        <button type="submit" disabled={payBusy} className="btn-primary w-full">
          {payBusy ? t('common.loading') : t('admin.savePayment')}
        </button>
      </form>

      {/* استعادة كلمة السرّ */}
      <div className={CARD}>
        <SectionHead icon={<LockOpenIcon className="h-5 w-5" />} title={t('admin.resetSection')} desc={t('admin.resetHint')} />

        <Field label={t('admin.userEmail')} tip={t('admin.userEmailTip')} required>
          <input type="email" dir="ltr" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </Field>

        <button
          type="button"
          onClick={sendReset}
          disabled={!email.trim() || busy === 'send'}
          className="btn-primary w-full gap-2"
        >
          <MailIcon className="h-4 w-4" /> {busy === 'send' ? t('common.loading') : t('admin.sendResetBtn')}
        </button>
        <p className="text-[11px] leading-relaxed text-stone-400">{t('admin.sendResetWhy')}</p>

        {/* المسار اليدويّ مطويّ: يترك كلمة سرٍّ صريحة تمرّ في قناةٍ غير آمنة
            ويجعل المدير عارفاً بسرّ غيره. يبقى لحالة تعذّر البريد فقط. */}
        <button
          type="button"
          onClick={() => setManual((v) => !v)}
          className="text-[11px] font-semibold text-gold-300 underline-offset-2 hover:underline"
        >
          {manual ? t('common.less') : t('admin.manualToggle')}
        </button>

        {manual && (
          <form onSubmit={setDirectly} className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-500/[0.07] p-3">
            <p className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-400">
              <WarnIcon className="mt-px h-3.5 w-3.5 shrink-0" /> {t('admin.manualWarn')}
            </p>
            <Field label={t('admin.newPassword')} tip={t('admin.newPasswordTip')} required>
              <div className="flex gap-2">
                <input type="text" required dir="ltr" className="input min-w-0 flex-1" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <button type="button" onClick={() => setNewPassword(genPassword())} className="btn-ghost shrink-0 !px-3 text-xs">
                  {t('admin.generate')}
                </button>
              </div>
            </Field>
            <button type="submit" disabled={!email.trim() || !newPassword || busy === 'manual'} className="btn-ghost w-full">
              {busy === 'manual' ? t('common.loading') : t('admin.doReset')}
            </button>
          </form>
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-stone-400">
        {t('admin.settingsLogged')} <Tip text={t('admin.settingsLoggedTip')} />
      </p>
    </div>
  );
}
