import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { GiftIcon, UsersIcon, TrophyIcon, WhatsAppIcon, PhoneIcon, CopyIcon, CheckIcon, SearchIcon, XIcon, GearIcon, WarnIcon } from '../../components/icons.jsx';
import { PageHead, SectionHead, Tip } from '../../components/FormField.jsx';
import { buildWhatsappLink } from '../../utils/whatsapp.js';

// لوحة الإحالات لصاحب المتجر: من أحال ومن، وكم زبونة جاءت عبر كل كود.
export default function ReferralsManager() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState('');

  const load = () => {
    setError('');
    api.get('/referrals').then((r) => setData(r.data)).catch((e) => setError(getErrorMessage(e)));
  };
  useEffect(load, []);

  // خطأ الشبكة كان يستبدل الصفحة بنص أحمر بلا مخرج — الحل الوحيد تحديث المتصفّح يدوياً
  if (error) {
    return (
      <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-4 text-sm text-red-300">
        <p>{error}</p>
        <button type="button" onClick={load} className="btn-ghost mt-3 !px-4 !py-1.5 text-xs">{t('assistant.retry')}</button>
      </div>
    );
  }
  if (!data) return <Spinner />;

  const list = data.referrals || [];
  const percent = Number(data.percent || 0);
  const active = percent > 0;
  const shown = list.filter((r) => {
    const needle = q.trim().toLowerCase();
    return !needle || `${r.name} ${r.phone} ${r.code}`.toLowerCase().includes(needle);
  });
  const top = list[0]; // الخادم يرتّبها بالأكثر جلباً

  const copyCode = async (r) => {
    try { await navigator.clipboard.writeText(r.code); setCopied(r.code); setTimeout(() => setCopied(''), 1600); } catch { /* تجاهُل */ }
  };

  // رسالة شكر جاهزة للمُحيلة — «كافئيهنّ» بلا صياغة كل مرّة من الصفر
  const thanksLink = (r) => buildWhatsappLink(r.phone, t('dashboard.referrals.thanksMsg', {
    name: r.name || '',
    store: data.storeName || '',
    count: r.uses,
  }));

  const CARD = 'dash-section glass space-y-4 p-5 sm:p-6';
  const medal = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-5">
      <PageHead icon={<GiftIcon className="h-6 w-6" />} title={t('dashboard.referrals.title')} hint={t('dashboard.referrals.subtitle')} />

      {/* حالة البرنامج: بلا نسبة خصم لا يستطيع أحد الإحالة — نقولها صراحةً مع مخرج */}
      <div className={`${CARD} ${active ? '' : '!border-amber-400/30'}`}>
        <SectionHead
          icon={active ? <GiftIcon className="h-5 w-5" /> : <WarnIcon className="h-5 w-5" />}
          title={t('dashboard.referrals.programTitle')}
          desc={t('dashboard.referrals.programHint')}
        />
        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gold-400/15 bg-black/20 p-3">
            <span className="flex items-center gap-1.5 text-sm text-stone-300">
              {t('dashboard.referrals.currentPercent')}
              <Tip text={t('dashboard.referrals.percentTip')} />
            </span>
            <span className="flex items-center gap-2">
              <span className="font-display text-2xl font-extrabold tabular-nums text-emerald-400">{percent}%</span>
              <Link to="/dashboard?tab=storeSettings" className="inline-flex items-center gap-1 rounded-full border border-gold-400/30 px-2.5 py-1 text-[11px] font-semibold text-gold-200 transition hover:bg-gold-400/10">
                <GearIcon className="h-3.5 w-3.5" /> {t('common.edit')}
              </Link>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3">
            <span className="min-w-0 text-sm font-semibold text-amber-300">{t('dashboard.referrals.offNotice')}</span>
            <Link to="/dashboard?tab=storeSettings" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-wine px-3 py-1.5 text-xs font-bold text-cream transition hover:bg-wine-dark">
              <GearIcon className="h-3.5 w-3.5" /> {t('dashboard.referrals.turnOn')}
            </Link>
          </div>
        )}
      </div>

      {/* لمحة سريعة */}
      <div className={CARD}>
        <SectionHead icon={<TrophyIcon className="h-5 w-5" />} title={t('dashboard.referrals.statsTitle')} desc={t('dashboard.referrals.statsHint')} />
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-gold-400/15 bg-black/20 p-3 text-center">
            <p className="font-display text-2xl font-extrabold tabular-nums text-gold-300">{data.totalReferred || 0}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-stone-400">{t('dashboard.referrals.totalReferred')}</p>
          </div>
          <div className="rounded-2xl border border-gold-400/15 bg-black/20 p-3 text-center">
            <p className="font-display text-2xl font-extrabold tabular-nums text-stone-100">{list.length}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-stone-400">{t('dashboard.referrals.referrersCount')}</p>
          </div>
          <div className="rounded-2xl border border-gold-400/15 bg-black/20 p-3 text-center">
            <p className="truncate font-display text-base font-extrabold text-emerald-400">{top?.uses ? (top.name || t('dashboard.referrals.noName')) : '—'}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-stone-400">{t('dashboard.referrals.topReferrer')}</p>
          </div>
        </div>
      </div>

      {/* قائمة المُحيلات */}
      <div className={CARD}>
        <SectionHead
          icon={<UsersIcon className="h-5 w-5" />}
          title={t('dashboard.referrals.listTitle')}
          desc={list.length ? t('dashboard.referrals.listCount', { count: list.length }) : t('dashboard.referrals.listHint')}
        />

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gold-400/25 bg-black/15 p-8 text-center">
            <GiftIcon className="h-8 w-8 text-gold-300" />
            <span className="text-sm text-stone-400">{t('dashboard.referrals.empty')}</span>
          </div>
        ) : (
          <>
            {list.length > 4 && (
              <div className="flex items-center gap-2 rounded-xl border border-gold-400/15 bg-black/20 px-3 focus-within:border-gold-400/60 focus-within:ring-2 focus-within:ring-gold-400/25">
                <SearchIcon className="h-4 w-4 shrink-0 text-stone-400" />
                <input
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none"
                  placeholder={t('dashboard.referrals.searchPlaceholder')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button type="button" onClick={() => setQ('')} aria-label={t('common.cancel')} className="shrink-0 text-stone-400 transition hover:text-gold-200">
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {shown.length === 0 ? (
              <p className="rounded-2xl border border-gold-400/15 bg-black/20 py-8 text-center text-sm text-stone-400">{t('dashboard.referrals.noMatch')}</p>
            ) : (
              <div className="space-y-2.5">
                {shown.map((r) => {
                  const rank = list.indexOf(r);
                  return (
                    <div key={r.code} className="rounded-2xl border border-gold-400/15 bg-black/20 p-3">
                      <div className="flex items-center gap-2.5">
                        {/* الترتيب: ميدالية لأول ثلاثة ثم رقم — «الأكثر جلباً» بلمحة */}
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gold-400/10 text-xs font-bold text-gold-200">
                          {rank < 3 && r.uses > 0 ? medal[rank] : rank + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-stone-100">{r.name || t('dashboard.referrals.noName')}</p>
                          <p className="mt-0.5 truncate text-[11px] text-stone-400" dir="ltr">{r.phone}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-sm font-bold text-emerald-400 ring-1 ring-emerald-500/20">
                          {r.uses} <span className="text-[11px] font-medium">{t('referral.uses')}</span>
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2.5">
                        {/* كودها يُنسخ بضغطة — تحتاجه المالكة للتحقّق أو المشاركة */}
                        <button
                          type="button" onClick={() => copyCode(r)}
                          title={t('common.copyLink')} aria-label={t('common.copyLink')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gold-400/10 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-gold-200 transition hover:bg-gold-400/20"
                          dir="ltr"
                        >
                          {r.code}
                          {copied === r.code ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5 opacity-60" />}
                        </button>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <a
                            href={thanksLink(r)} target="_blank" rel="noreferrer"
                            title={t('dashboard.referrals.thank')} aria-label={t('dashboard.referrals.thank')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 transition hover:bg-emerald-500/25"
                          >
                            <WhatsAppIcon className="h-4 w-4" /> {t('dashboard.referrals.thank')}
                          </a>
                          <a
                            href={`tel:${String(r.phone).replace(/\s/g, '')}`}
                            title={t('dashboard.ordersSection.call')} aria-label={t('dashboard.ordersSection.call')}
                            className="grid h-8 w-8 place-items-center rounded-xl border border-gold-400/20 text-stone-400 transition hover:border-gold-400/50 hover:text-gold-200"
                          >
                            <PhoneIcon className="h-4 w-4" />
                          </a>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
