import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { PageHead, Tip } from '../../components/FormField.jsx';
import { ShieldIcon, EyeOffIcon, EyeIcon, CrownIcon, TrashIcon, StarIcon, CheckIcon, XIcon, PlusIcon } from '../../components/icons.jsx';

// لون كل فعل بحسب أثره: الأحمر لما يحجب أو يحذف، الأخضر لما يمنح، والرمادي
// لما يعدّل. ألوان صريحة مصمتة كي تُقرأ في الوضعين.
const ACTIONS = {
  'product.hide': { tone: '#b91c1c', Icon: EyeOffIcon },
  'product.unhide': { tone: '#047857', Icon: EyeIcon },
  'subscriber.delete': { tone: '#b91c1c', Icon: TrashIcon },
  'request.reject': { tone: '#b91c1c', Icon: XIcon },
  'request.approve': { tone: '#047857', Icon: CheckIcon },
  'subscription.set': { tone: '#047857', Icon: CrownIcon },
  'subscription.addDays': { tone: '#047857', Icon: PlusIcon },
  'store.feature': { tone: '#92400e', Icon: StarIcon },
  'store.unfeature': { tone: '#57534e', Icon: StarIcon },
  'user.resetPassword': { tone: '#b91c1c', Icon: ShieldIcon },
};

// قيمة الحقل كما تُقرأ: التاريخ بصيغة محلّية لا ISO، والبقيّة نصّاً مقصوصاً.
const fmtVal = (k, v, lang) => {
  if (/At$|End$/.test(k) && v) {
    const d = new Date(v);
    if (!isNaN(d)) return d.toLocaleDateString(lang);
  }
  return String(v).slice(0, 60);
};

// سجلّ أفعال المدير — كل فعل إداريّ ومن نفّذه ومتى.
export default function AdminLog() {
  const { t, i18n } = useTranslation();
  const [actions, setActions] = useState(null);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('all');

  useEffect(() => {
    api.get('/subscription/admin-log')
      .then((r) => setActions(r.data.actions))
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  // الأنواع الموجودة فعلاً لا كل الأنواع الممكنة: قائمةٌ بخيارات فارغة تُضلّل
  const kinds = useMemo(() => {
    const seen = new Set((actions || []).map((a) => a.action));
    return ['all', ...Object.keys(ACTIONS).filter((k) => seen.has(k))];
  }, [actions]);

  const shown = (actions || []).filter((a) => kind === 'all' || a.action === kind);

  if (actions === null && !error) return <Spinner />;

  const when = (d) => (d ? new Date(d).toLocaleString(i18n.language) : '—');

  return (
    <div className="space-y-5">
      <PageHead icon={<ShieldIcon className="h-6 w-6" />} title={t('admin.logTitle')} hint={t('admin.logHint')} />
      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {actions && actions.length > 0 && kinds.length > 2 && (
        <div className="w-56">
          <Select
            value={kind}
            onChange={setKind}
            className="!py-2 text-sm"
            options={kinds.map((k) => ({ value: k, label: k === 'all' ? t('admin.filterAll') : t(`admin.act.${k}`, k) }))}
          />
        </div>
      )}

      {actions && actions.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('admin.logEmpty')}</div>
      ) : (
        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-gold-400/15 bg-black/20">
          {shown.map((a) => {
            const meta = ACTIONS[a.action] || { tone: '#57534e', Icon: ShieldIcon };
            const { Icon } = meta;
            return (
              <div key={a.id} className="flex items-start gap-2.5 p-3">
                <span
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-cream"
                  style={{ background: meta.tone }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-semibold text-stone-100">
                    {t(`admin.act.${a.action}`, a.action)}
                    {a.targetLabel && <span className="min-w-0 truncate font-normal text-stone-300">— {a.targetLabel}</span>}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-stone-400">
                    {a.adminEmail || '—'} · {when(a.createdAt)}
                  </p>
                  {/* التفاصيل تُعرض كما سُجّلت: سبب الإخفاء والخطّة والأيام */}
                  {a.details && Object.keys(a.details).length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {Object.entries(a.details).map(([k, v]) => (
                        <span key={k} className="rounded-full border border-gold-400/20 px-2 py-0.5 text-[10px] text-stone-300">
                          {t(`admin.field.${k}`, k)}: {fmtVal(k, v, i18n.language)}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {actions && actions.length > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-stone-400">
          {t('admin.logCount', { count: shown.length })} <Tip text={t('admin.logCountTip')} />
        </p>
      )}
    </div>
  );
}
