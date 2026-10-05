import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSessionState from '../../hooks/useSessionState.js';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { waCandidates } from '../../utils/whatsapp.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { UsersIcon, WhatsAppIcon, PhoneIcon, SearchIcon, XIcon, ReceiptIcon, NoteIcon } from '../../components/icons.jsx';
import { PageHead } from '../../components/FormField.jsx';

// ═════ «زبائني» ═════
// كلُّ من طلبَ من المتجر، مجمّعاً برقمِه (0591… و+970591… زبونةٌ واحدة)، والأكثرُ شراءً
// أوّلاً. السؤالُ الذي تفتحُ التاجرةُ الصفحةَ لأجلِه: مين زبائني الحقيقيّات، ومين
// اشترت مرّة واختفت — والجوابُ ينتهي بزرّ: عرضٌ على واتساب باسمِها.

const GONE_DAYS = 45; // من آخرِ طلبٍ — بعدها تُعدّ «غابت»
const DAY = 86400000;
const TABS = ['all', 'back', 'once', 'gone'];
const OFFER_KEY = 'bz_cust_offer:';

const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || '';
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
const inTab = (c, tab) => {
  if (tab === 'back') return c.done >= 2;
  if (tab === 'once') return c.done === 1;
  if (tab === 'gone') return c.done >= 1 && daysSince(c.lastAt) > GONE_DAYS;
  return true;
};

export default function CustomersManager() {
  const { t, i18n } = useTranslation();
  const { store } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useSessionState('customers:tab', 'all');
  const [q, setQ] = useSessionState('customers:q', '');
  const [editOffer, setEditOffer] = useState(false);
  const offerKey = OFFER_KEY + (store?.id || '');
  const [offer, setOffer] = useState(() => {
    try { return localStorage.getItem(offerKey) || ''; } catch { return ''; }
  });
  const offerText = offer.trim() || t('dashboard.customers.offerDefault');

  useEffect(() => {
    api.get('/orders/customers')
      .then((r) => setList(r.data.customers || []))
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const saveOffer = (v) => {
    setOffer(v);
    try { if (v.trim()) localStorage.setItem(offerKey, v); else localStorage.removeItem(offerKey); } catch { /* تصفّح خاص */ }
  };

  const counts = useMemo(() => Object.fromEntries(TABS.map((k) => [k, (list || []).filter((c) => inTab(c, k)).length])), [list]);
  const totalSpent = useMemo(() => (list || []).reduce((n, c) => n + c.spent, 0), [list]);

  if (list === null && !error) return <Spinner />;

  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const visible = (list || []).filter((c) => {
    if (!inTab(c, tab)) return false;
    if (!term) return true;
    return c.name.toLowerCase().includes(term)
      || c.city.toLowerCase().includes(term)
      || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits));
  });

  const fill = (c) => offerText
    .replace(/\{(الاسم|name)\}/g, firstName(c.name))
    .replace(/\{(المتجر|store)\}/g, store?.name || '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([،,.!؟?])/g, '$1')
    .trim();
  const waHref = (c) => `https://wa.me/${c.wa || waCandidates(c.phone)[0]}?text=${encodeURIComponent(fill(c))}`;

  // «طلباتها»: صفحةُ الطلبات مبحوثٌ فيها برقمِها. الصفحةُ قد تكونُ حيّةً بالخلفيّة
  // (Activity) فلا تقرأُ ذاكرةَ الجلسةِ من جديد — فنخبرُها بحدث، ونكتبُ للذاكرةِ لمن لم تُفتح بعد.
  const openOrders = (c) => {
    try {
      sessionStorage.setItem('bz_ss:orders:q', JSON.stringify(c.phone));
      sessionStorage.setItem('bz_ss:orders:status', JSON.stringify('all'));
      window.dispatchEvent(new CustomEvent('bz:orders-search', { detail: c.phone }));
    } catch { /* تجاهل */ }
    navigate('/dashboard?tab=myOrders');
  };

  const fmtDate = (iso) => {
    const d = daysSince(iso);
    if (d <= 0) return t('dashboard.customers.today');
    if (d < 30) return t('dashboard.customers.daysAgo', { count: d });
    return new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'ar-PS', { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined });
  };

  return (
    <div className="space-y-4">
      <PageHead icon={<UsersIcon className="h-6 w-6" />} title={t('dashboard.customers.title')} hint={t('dashboard.customers.hint')} />

      {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}

      {list?.length === 0 && (
        <div className="dash-section glass p-5 sm:p-6">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gold-400/25 bg-black/15 p-8 text-center">
            <UsersIcon className="h-8 w-8 text-gold-300" />
            <p className="font-bold text-stone-100">{t('dashboard.customers.emptyTitle')}</p>
            <p className="max-w-sm text-sm text-stone-400">{t('dashboard.customers.empty')}</p>
          </div>
        </div>
      )}

      {list?.length > 0 && (
        <>
          <div className="bz-osum grid grid-cols-3 overflow-hidden rounded-2xl">
            <div className="bz-osum-cell px-3 py-3 text-center">
              <p className="bz-osum-k text-[11px] font-semibold">{t('dashboard.customers.sumAll')}</p>
              <p className="bz-osum-v mt-0.5 font-display text-xl font-extrabold tabular-nums">{list.length}</p>
            </div>
            <button type="button" onClick={() => setTab(tab === 'back' ? 'all' : 'back')} className="bz-osum-cell app-tap px-3 py-3 text-center">
              <p className="bz-osum-k text-[11px] font-semibold">{t('dashboard.customers.sumBack')}</p>
              <p className="bz-osum-v mt-0.5 font-display text-xl font-extrabold tabular-nums">
                {counts.back}
                {list.length > 0 && <span className="ms-1.5 align-middle text-[11px] font-bold opacity-55">({Math.round((counts.back / list.length) * 100)}%)</span>}
              </p>
            </button>
            <div className="bz-osum-cell px-3 py-3 text-center">
              <p className="bz-osum-k text-[11px] font-semibold">{t('dashboard.customers.sumSpent')}</p>
              <p className="bz-osum-v mt-0.5 font-display text-xl font-extrabold tabular-nums">{t('common.currency')}{Math.round(totalSpent)}</p>
            </div>
          </div>

          <div className="bz-obar sticky top-[calc(var(--bz-headline-h)+var(--bz-tabbar-h,0px))] z-30 -mx-1 space-y-2 rounded-2xl px-1 py-2 transition-[top] duration-300 ease-out motion-reduce:transition-none">
            <div className="flex items-center gap-2">
              <div className="bz-osearch flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3">
                <SearchIcon className="h-4 w-4 shrink-0 text-stone-400" />
                <input
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none"
                  placeholder={t('dashboard.customers.search')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button type="button" onClick={() => setQ('')} aria-label={t('common.cancel')} className="shrink-0 text-stone-400 transition hover:text-gold-200">
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditOffer((v) => !v)}
                aria-expanded={editOffer}
                className={`bz-osearch app-tap flex h-[42px] shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-bold ${editOffer ? 'is-on' : ''}`}
              >
                <NoteIcon className="h-4 w-4" />
                {t('dashboard.customers.offer')}
              </button>
            </div>
            <div className="bz-ochips -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist">
              {TABS.map((k) => {
                const on = tab === k;
                return (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTab(k)}
                    className={`bz-ochip app-tap inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${on ? 'is-on' : ''}`}
                  >
                    {t(`dashboard.customers.tabs.${k}`)}
                    <span className="bz-ochip-n tabular-nums">{counts[k]}</span>
                  </button>
                );
              })}
            </div>
            {editOffer && (
              <div className="bz-otoolsbar space-y-1.5 rounded-xl p-2.5">
                <textarea
                  rows={3}
                  value={offer || t('dashboard.customers.offerDefault')}
                  onChange={(e) => saveOffer(e.target.value)}
                  className="w-full resize-y rounded-lg border border-gold-400/20 bg-black/10 p-2.5 text-sm text-stone-100 focus:border-gold-400/60 focus:outline-none"
                />
                <div className="flex items-center justify-between gap-2 text-[11px] text-stone-400">
                  <span>{t('dashboard.customers.offerHint')}</span>
                  {offer && (
                    <button type="button" onClick={() => saveOffer('')} className="shrink-0 font-bold text-gold-300 hover:underline">
                      {t('dashboard.customers.offerReset')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {tab === 'gone' && counts.gone > 0 && (
            <p className="px-1 text-[12.5px] leading-relaxed text-stone-400">{t('dashboard.customers.goneHint', { days: GONE_DAYS })}</p>
          )}

          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-400">{t('dashboard.customers.noMatch')}</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((c) => {
                const rank = list.indexOf(c) + 1;
                const gone = c.done >= 1 && daysSince(c.lastAt) > GONE_DAYS;
                return (
                  <li key={c.key} className="bz-cust glass flex items-center gap-3 rounded-2xl p-3">
                    <span className={`bz-cust-ava relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-extrabold ${rank <= 3 && c.spent > 0 ? `is-top is-top${rank}` : ''}`}>
                      {firstName(c.name).slice(0, 1) || '؟'}
                      {rank <= 3 && c.spent > 0 && <span className="bz-cust-rank absolute -bottom-1 -end-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold tabular-nums">{rank}</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-stone-100">{c.name || c.phone}</p>
                        {c.done >= 2 && <span className="bz-cust-chip is-back shrink-0 rounded-full px-1.5 text-[10px] font-bold leading-4">{t('dashboard.customers.badgeBack')}</span>}
                        {gone && <span className="bz-cust-chip is-new shrink-0 rounded-full px-1.5 text-[10px] font-bold leading-4">{t('dashboard.customers.badgeGone')}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-stone-400">
                        {[c.city, t('dashboard.customers.last', { when: fmtDate(c.lastAt) })].filter(Boolean).join(' · ')}
                        {c.cancelled > 0 && <span className="text-red-400"> · {t('dashboard.customers.cancelled', { count: c.cancelled })}</span>}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="font-display text-[15px] font-extrabold tabular-nums text-stone-100">{t('common.currency')}{Math.round(c.spent)}</p>
                      <button type="button" onClick={() => openOrders(c)} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-stone-400 hover:text-gold-200">
                        <ReceiptIcon className="h-3 w-3" />
                        {t('dashboard.customers.orders', { count: c.orders })}
                      </button>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <a href={waHref(c)} target="_blank" rel="noopener noreferrer" title={t('dashboard.customers.sendOffer')} aria-label={t('dashboard.customers.sendOffer')} className="bz-oquick-ico is-wa app-tap grid h-9 w-9 place-items-center rounded-xl">
                        <WhatsAppIcon className="h-[18px] w-[18px]" />
                      </a>
                      <a href={`tel:${c.phone}`} aria-label={t('dashboard.customers.call')} className="bz-oquick-ico app-tap grid h-9 w-9 place-items-center rounded-xl">
                        <PhoneIcon className="h-4 w-4" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
