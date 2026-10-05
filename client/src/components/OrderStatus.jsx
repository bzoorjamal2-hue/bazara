import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmModal from './ConfirmModal.jsx';
import { CheckIcon, ClockIcon, TruckIcon, PackageIcon, XIcon, LockIcon } from './icons.jsx';

// ═════════ حالةُ الطلب ═════════
// كانت قائمةً منسدلةً عامّةً بنصٍّ رماديٍّ بجانبِ كلمةِ «تحديث الحالة:» — لا تقولُ أين
// وصلَ الطلبُ في رحلتِه ولا ما الخطوةُ التالية، و«ملغى» فيها بضغطةٍ واحدةٍ كأيِّ خيار.
// صارت شريطَ مراحلَ ملوّناً تُرى منه الرحلةُ كلُّها، وزرّاً كبيراً للخطوةِ التالية،
// والإلغاءُ وحدَه يُسأَلُ عنه قبلَ وقوعِه.

export const STEPS = ['new', 'confirmed', 'shipped', 'delivered'];
export const NEXT = { new: 'confirmed', confirmed: 'shipped', shipped: 'delivered' };
const ICON = { new: ClockIcon, confirmed: CheckIcon, shipped: TruckIcon, delivered: PackageIcon };
// نصُّ زرِّ الخطوةِ التالية: فعلٌ يُقرَأُ («أكّدي الطلب») لا اسمُ حالة («مؤكّد»)
export const ACTION = { confirmed: 'actConfirm', shipped: 'actShip', delivered: 'actDeliver' };

// شارةُ الحالةِ الصغيرةُ برأسِ البطاقة، بلونِ حالتِها نفسِه
export function StatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <span className={`bz-stbadge bz-st-${status} inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold`}>
      <span className="bz-stdot h-1.5 w-1.5 rounded-full" aria-hidden />
      {t(`dashboard.ordersSection.${status}`)}
    </span>
  );
}

// وقتُ بلوغِ المرحلةِ بكلمةٍ قصيرة: الساعةُ لليوم، «أمس»، وإلّا اليومُ والشهر
function stepTime(iso, t, lang) {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const now = new Date();
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(at)) / 86400000);
  if (diff === 0) return at.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' });
  if (diff === 1) return t('dashboard.ordersSection.yesterday');
  return at.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
}

export default function OrderStatus({ status, onChange, saving = false, locked = null, statusAt = {}, createdAt = null }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const [askCancel, setAskCancel] = useState(false);
  const cur = STEPS.includes(status) || status === 'cancelled' ? status : 'new';
  const idx = STEPS.indexOf(cur);
  const next = NEXT[cur];
  const NextIcon = next ? ICON[next] : null;

  if (cur === 'cancelled') {
    return (
      <div className="bz-st-cancelled bz-ost mt-3 flex items-center gap-3 rounded-2xl p-3">
        <span className="bz-ost-ico flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <XIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="bz-ost-title block text-sm font-bold">{t('dashboard.ordersSection.cancelledTitle')}</span>
          <span className="bz-ost-sub block text-[11px]">{t('dashboard.ordersSection.cancelledSub')}</span>
        </span>
        {!locked && (
          <button
            onClick={() => onChange('new')}
            disabled={saving}
            className="bz-ost-ghost shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-50"
          >
            {t('dashboard.ordersSection.restore')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bz-st-${cur} bz-ost mt-3 rounded-2xl p-3`}>
      {/* المراحلُ الأربع: ما مضى مملوءٌ بعلامة، والحاليّةُ بأيقونتِها وحلقة، وما بعدُ باهت.
          وكلُّ مرحلةٍ زرٌّ — للتصحيحِ أو للقفزِ مباشرةً (طلبٌ سُلِّمَ يداً بيد مثلاً). */}
      <ol className="flex items-start">
        {STEPS.map((s, i) => {
          const done = i < idx;
          const here = i === idx;
          const Icon = ICON[s];
          return (
            <li key={s} className="relative flex flex-1 flex-col items-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={`bz-ost-line absolute top-[15px] h-[3px] rounded-full ${i <= idx ? 'is-on' : ''}`}
                  style={{ insetInlineStart: 'calc(-50% + 18px)', width: 'calc(100% - 36px)' }}
                />
              )}
              <button
                type="button"
                disabled={Boolean(locked) || saving || here}
                onClick={() => onChange(s)}
                aria-current={here ? 'step' : undefined}
                title={t('dashboard.ordersSection.moveTo', { status: t(`dashboard.ordersSection.${s}`) })}
                className={`bz-ost-dot relative z-10 flex h-8 w-8 items-center justify-center rounded-full transition ${done ? 'is-done' : here ? 'is-here' : 'is-todo'} disabled:cursor-default`}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </button>
              <span className={`mt-1.5 text-center text-[10.5px] leading-tight ${here ? 'bz-ost-here-label font-extrabold' : done ? 'bz-ost-sub font-semibold' : 'bz-ost-sub'}`}>
                {t(`dashboard.ordersSection.${s}`)}
              </span>
              {/* متى بلغَها: ما مضى والحاليّةُ فقط — والجديدُ وقتُ وصولِ الطلبِ نفسِه */}
              {i <= idx && (s === 'new' ? createdAt : statusAt?.[s]) && (
                <span className="bz-ost-sub mt-0.5 text-center text-[9.5px] tabular-nums leading-none" dir="auto">
                  {stepTime(s === 'new' ? createdAt : statusAt[s], t, lang)}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {locked ? (
        // بعهدةِ شركةِ التوصيل: الحالةُ تتحدّثُ من عندهم، والمراحلُ للعرضِ فقط
        <p className="bz-ost-sub mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold">
          <LockIcon className="h-3.5 w-3.5" /> {locked}
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          {next ? (
            <button
              onClick={() => onChange(next)}
              disabled={saving}
              className={`bz-st-${next} bz-ost-next flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:opacity-60`}
            >
              {saving
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : <NextIcon className="h-[18px] w-[18px]" />}
              {t(`dashboard.ordersSection.${ACTION[next]}`)}
            </button>
          ) : (
            <span className="bz-ost-done flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold">
              <CheckIcon className="h-4 w-4" /> {t('dashboard.ordersSection.completed')}
            </span>
          )}
          <button
            onClick={() => setAskCancel(true)}
            disabled={saving}
            className="bz-ost-cancel min-h-[42px] shrink-0 rounded-xl px-3.5 text-xs font-bold transition disabled:opacity-50"
          >
            {t('dashboard.ordersSection.cancelOrder')}
          </button>
        </div>
      )}

      <ConfirmModal
        open={askCancel}
        title={t('dashboard.ordersSection.cancelTitle')}
        message={t('dashboard.ordersSection.cancelMsg')}
        confirmLabel={t('dashboard.ordersSection.cancelYes')}
        cancelLabel={t('dashboard.ordersSection.keepOrder')}
        onConfirm={() => { setAskCancel(false); onChange('cancelled'); }}
        onCancel={() => setAskCancel(false)}
      />
    </div>
  );
}
