import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { InstagramIcon, FacebookIcon, BagIcon, BackIcon, CheckIcon, PlusIcon, SearchIcon, XIcon, ClockIcon } from '../../components/icons.jsx';
import { startFbLogin, igRedirectUri } from '../../utils/fbSdk.js';
import { filterConvs, listStamp, replyWindow, productCard } from '../../utils/chat.js';
import * as cache from '../../utils/chatCache.js';
import { PageHead } from '../../components/FormField.jsx';
// المشتركُ مع شاشةِ المحادثةِ يسكنُ ملفّاً مستقلّاً، فلا تعتمدُ قطعةُ شاشةٍ على قطعةِ أخرى.
import { Avatar, OrderComposer } from '../../components/OrderComposer.jsx';

// ننظّف رابط الصفحة من بارامترات العودة (code/state) بعد معالجتها
function cleanOauthUrl() {
  try { window.history.replaceState({}, '', '/dashboard?tab=instagram'); } catch { /* تجاهل */ }
}

export default function InstagramInbox() {
  const { t } = useTranslation();
  // حالةُ الربطِ المحفوظةُ تُرسَمُ فوراً عند الرجوعِ من محادثة، ويُسأَلُ الخادمُ فوقَها
  const [status, setStatusRaw] = useState(() => cache.getStatus());
  const setStatus = (s) => { cache.setStatus(s); setStatusRaw(s); };
  const [error, setError] = useState('');
  const [pendingPages, setPendingPages] = useState(null); // عدّة صفحات بعد العودة من فيسبوك

  // الحالةُ ومعها الربطُ الناقص. من يدير أكثرَ من صفحةٍ يقفُ الخادمُ عند «اختر الصفحة»
  // ويحفظُ التوكنَ مؤقّتاً؛ وكانت القائمةُ لا تظهرُ إلّا إن التقطنا لحظةَ رجوعِه من
  // نافذةِ فيسبوك — فإن فاتتنا بقيَ الربطُ معلّقاً بلا أثرٍ يُرى، ولا رسالةَ تصل.
  // صارت تُسأَلُ مع كلِّ فتحةٍ للتبويب: ما دام هناك ربطٌ ناقصٌ فالقائمةُ حاضرة.
  const loadStatus = () =>
    api.get('/instagram/status').then(async (r) => {
      setStatus(r.data);
      if (r.data && !r.data.connected) {
        try {
          const pg = await api.get('/instagram/pending-pages');
          if (pg.data?.pages?.length) setPendingPages(pg.data.pages);
        } catch { /* تجاهل — الزرُّ يبقى متاحاً */ }
      }
    }).catch((e) => setError(getErrorMessage(e)));

  // عند التحميل: لو رجعنا من فيسبوك (?code=) نكمّل الربط، وإلا نجلب الحالة عادةً.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (params.get('error')) { setError(t('dashboard.instagram.loginCancelled')); cleanOauthUrl(); loadStatus(); return; }
    if (code) {
      api.post('/instagram/connect', { code, redirectUri: igRedirectUri() })
        .then((r) => { if (r.data.pages) setPendingPages(r.data.pages); })
        .catch((e) => setError(getErrorMessage(e)))
        .finally(() => { cleanOauthUrl(); loadStatus(); });
      return;
    }
    loadStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!status && !error) return <Spinner />;

  return (
    <div className="space-y-5">
      <PageHead icon={<InstagramIcon className="h-6 w-6" />} title={t('dashboard.instagram.title')} hint={t('dashboard.instagram.hint')} />

      {error && <div className="bz-note-err rounded-xl px-4 py-2.5 text-sm font-semibold">{error}</div>}

      {/* حلّ عملي فوري: تسجيل طلب من محادثة يدوياً — يعمل الآن بلا انتظار موافقة Meta */}
      <ManualOrderPanel />

      {status && !status.connected ? (
        <ConnectCard
          status={status}
          pendingPages={pendingPages}
          onPages={setPendingPages}
          onConnected={() => { setPendingPages(null); loadStatus(); }}
        />
      ) : status ? (
        <Inbox username={status.username} onDisconnected={loadStatus} />
      ) : null}
    </div>
  );
}

// ───────── بطاقة الربط (تسجيل دخول فيسبوك بإعادة توجيه) ─────────
function ConnectCard({ status, pendingPages, onConnected, onPages }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pages = pendingPages; // تظهر بعد العودة من فيسبوك لو عنده عدّة صفحات

  // الزرّ الأساسيّ: يفتحُ الربطَ في نافذةٍ مستقلّةٍ ومعه تذكرةٌ يعرفُ بها الخادمُ صاحبَ
  // الرحلة. وحين يعودُ صاحبُ المتجرِ إلى التطبيقِ نسألُ الخادمَ: هل تمّ؟
  const start = async (fresh = false) => {
    setError('');
    try {
      await startFbLogin({
        fresh,
        requestTicket: () => api.post('/instagram/link-token').then((r) => r.data.token).catch(() => ''),
      });
      watchReturn();
    } catch (e) { setError(getErrorMessage(e)); }
  };

  // النافذةُ المستقلّةُ لا تُخبرُنا بشيء، فنسألُ نحن عند عودةِ التطبيقِ إلى الواجهة:
  // إمّا صار مربوطاً فنُحدّث، وإمّا بقيت خطوةُ اختيارِ الصفحةِ فنعرضُها.
  const watchReturn = () => {
    const onVisible = async () => {
      if (document.hidden) return;
      try {
        const st = await api.get('/instagram/status');
        if (st.data?.connected) { document.removeEventListener('visibilitychange', onVisible); onConnected(); return; }
        const pg = await api.get('/instagram/pending-pages');
        if (pg.data?.pages?.length) { document.removeEventListener('visibilitychange', onVisible); onPages(pg.data.pages); }
      } catch { /* نُعيد المحاولة عند العودة القادمة */ }
    };
    document.addEventListener('visibilitychange', onVisible);
    setTimeout(() => document.removeEventListener('visibilitychange', onVisible), 10 * 60 * 1000);
  };

  // اختيار صفحة معيّنة (خطوة ثانية): يكمّل الربط بالتوكن المخزّن مؤقّتاً بالخادم.
  const pick = async (pageId) => {
    setBusy(true); setError('');
    try {
      await api.post('/instagram/connect', { pageId });
      onConnected();
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  };

  if (!status.enabled) {
    return (
      <div className="glass p-8 text-center">
        <InstagramIcon className="mx-auto h-10 w-10 text-stone-500" />
        <p className="mt-3 text-sm text-stone-300">{t('dashboard.instagram.notEnabled')}</p>
      </div>
    );
  }

  return (
    <div className="glass space-y-4 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-amber-500 text-white shadow-md">
          <InstagramIcon className="h-6 w-6" />
        </span>
        <div>
          <p className="font-display text-base font-bold text-gold-200">{t('dashboard.instagram.connectTitle')}</p>
          <p className="mt-1 text-sm text-stone-400">{t('dashboard.instagram.connectHint')}</p>
        </div>
      </div>

      {error && <div className="bz-note-err rounded-xl px-4 py-2.5 text-sm font-semibold">{error}</div>}

      {pages && pages.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-stone-300">{t('dashboard.instagram.choosePage')}</p>
          {pages.map((p) => (
            <button
              key={p.pageId}
              onClick={() => pick(p.pageId)}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-xl border border-gold-400/15 bg-black/20 px-4 py-3 text-sm text-stone-100 transition hover:bg-white/10 disabled:opacity-50"
            >
              <span>{p.name || p.pageId}{p.username ? <span className="text-gold-300"> · @{p.username}</span> : null}</span>
              <BackIcon className="h-4 w-4 rotate-180 text-stone-400" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* الزرُّ يملأُ العرضَ: كان بعرضِ نصِّه فيصطدمُ به الرابطُ الثانويُّ بجانبِه */}
          <button onClick={() => start(false)} disabled={busy} className="btn-primary w-full justify-center gap-2 !py-3">
            <InstagramIcon className="h-5 w-5" /> {t('dashboard.instagram.connectBtn')}
          </button>

          {/* البابانِ الثانويّانِ في سطرٍ واحدٍ يفصلُهما نقطة: كانا ثلاثةَ أسطرٍ متراكمةٍ
              تحت الزرِّ فبدت البطاقةُ قائمةَ روابطَ لا فعلاً واحداً واضحاً. */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px]">
            <button onClick={() => start(true)} className="font-semibold text-gold-200 underline underline-offset-2">
              {t('dashboard.instagram.otherAccount')}
            </button>
            <span aria-hidden className="text-stone-600">·</span>
            <button
              onClick={() => window.open('https://www.facebook.com/', '_blank')}
              className="text-stone-300 underline underline-offset-2"
            >
              {t('dashboard.instagram.fbLogout')}
            </button>
          </div>

          {/* الشرحُ مطويٌّ: يحتاجُه من ظهرَ له حسابُ غيرِه، ولا يحتاجُه الباقون */}
          <details className="text-center">
            <summary className="cursor-pointer list-none text-[11px] text-stone-400 underline underline-offset-2">
              {t('dashboard.instagram.whyAccount')}
            </summary>
            <p className="mt-2 text-start text-[11px] leading-relaxed text-stone-400">
              {t('dashboard.instagram.wrongAccount')}
            </p>
          </details>
        </div>
      )}

      <ul className="space-y-1.5 border-t border-white/5 pt-3 text-xs text-stone-400">
        <li className="flex gap-2"><CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" /> {t('dashboard.instagram.req1')}</li>
        <li className="flex gap-2"><CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" /> {t('dashboard.instagram.req2')}</li>
      </ul>
    </div>
  );
}

// ───────── الصندوق: قائمة المحادثات ─────────
// صفوفٌ بشكلِ تطبيقاتِ المحادثة: الصورةُ وعليها شارةُ القناة، والاسمُ عريضاً حين
// يكونُ فيها جديد، وآخرُ ما قيل مع «أنت:» إن كانت الكلمةُ الأخيرةُ لنا، ووقتٌ قصير.
// والتبويباتُ فوقَها تفرزُ ما يحتاجُ ردّاً عمّا انتهى.
const TABS = ['all', 'unread', 'waiting', 'orders'];

function Inbox({ username, onDisconnected }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [convs, setConvsRaw] = useState(() => cache.getConvs());
  const setConvs = (list) => { cache.setConvs(list); setConvsRaw(list); };
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const load = () =>
    api.get('/instagram/conversations')
      .then((r) => { setConvs(r.data.conversations); setError(''); })
      .catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // القائمةُ تتجدّدُ وحدَها ما دامت الشاشةُ ظاهرة: رسالةٌ جديدةٌ تصلُ وأنت تنظرُ إلى
  // القائمةِ يجبُ أن تُرى. عشرون ثانيةً لا عشر: القائمةُ تُقرَأُ لا تُراقَب، والرسالةُ
  // الجديدةُ يصلُ معها إشعارٌ على كلِّ حال.
  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const timer = setInterval(tick, 20000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // «منذ كم» تتقدّمُ وحدَها
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const counts = useMemo(() => {
    const list = convs || [];
    return {
      all: list.length,
      unread: list.filter((c) => c.unread > 0).length,
      waiting: list.filter((c) => c.last_dir === 'in').length,
      orders: list.filter((c) => c.order_id).length,
    };
  }, [convs]);

  // البحثُ بالاسمِ أو المعرّفِ أو نصِّ آخرِ رسالة، بعد تطبيعِ العربيّة — وإلّا لم
  // تُطابَق «عبايه» بـ«عباية». والتصفيةُ هنا لا عند الخادم: المئةُ محادثةٍ في اليدِ أصلاً.
  const shown = useMemo(() => filterConvs(convs || [], { q, tab }), [convs, q, tab]);

  const stampText = (iso) => {
    const s = listStamp(iso);
    if (s.kind === 'now') return t('dashboard.instagram.justNow');
    if (s.kind === 'min') return t('dashboard.instagram.minShort', { count: s.value });
    if (s.kind === 'time') return s.at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (s.kind === 'yesterday') return t('common.yesterday', { defaultValue: locale === 'ar' ? 'أمس' : 'Yesterday' });
    if (s.kind === 'weekday') return s.at.toLocaleDateString(locale, { weekday: 'short' });
    if (s.kind === 'date') return s.at.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return '';
  };

  const disconnect = async () => {
    try { await api.post('/instagram/disconnect'); onDisconnected(); } catch (e) { setError(getErrorMessage(e)); }
  };

  return (
    <div className="space-y-3">
      {/* شريط الحساب المربوط */}
      <div className="glass flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-sm text-stone-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-amber-500 text-white"><InstagramIcon className="h-4 w-4" /></span>
          {username ? <span dir="ltr" className="font-semibold text-gold-200">@{username}</span> : t('dashboard.instagram.connected')}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={refreshing} className="btn-ghost !py-1.5 text-xs disabled:opacity-60">
            {refreshing ? t('common.loading') : t('common.refresh')}
          </button>
          <button onClick={disconnect} className="text-xs text-stone-400 underline-offset-2 hover:text-red-300 hover:underline">{t('dashboard.instagram.disconnect')}</button>
        </div>
      </div>

      {error && <div className="bz-note-err rounded-xl px-4 py-2.5 text-sm font-semibold">{error}</div>}

      {/* البحثُ لا يظهرُ إلّا حين يكونُ له معنى: محادثتان لا تُبحَثان */}
      {(convs || []).length > 4 && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            className="input !ps-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('dashboard.instagram.searchChats')}
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-400" aria-label={t('common.cancel')}>
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* التبويبات: «بانتظار ردّك» أهمُّها — آخرُ كلمةٍ للزبونِ ولم يُردَّ عليه */}
      {(convs || []).length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {TABS.map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`bz-inbox-tab inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${tab === k ? 'bz-inbox-tab-on' : ''}`}
            >
              {t(`dashboard.instagram.tab_${k}`)}
              {k !== 'all' && counts[k] > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${k === 'unread' ? 'bg-gold-400 bz-on-gold' : 'bz-inbox-tab-count'}`}>
                  {counts[k] > 99 ? '99+' : counts[k]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {convs === null && !error ? (
        <div className="glass overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-white/5 px-3 py-3.5 last:border-0">
              <span className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-stone-500/20" />
              <span className="flex-1 space-y-2">
                <span className="block h-3 w-1/3 animate-pulse rounded bg-stone-500/20" />
                <span className="block h-3 w-2/3 animate-pulse rounded bg-stone-500/15" />
              </span>
            </div>
          ))}
        </div>
      ) : (convs && convs.length === 0) ? (
        <div className="glass flex flex-col items-center gap-3 p-10 text-center text-stone-400">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-amber-500 text-white shadow-md">
            <InstagramIcon className="h-7 w-7" />
          </span>
          {t('dashboard.instagram.empty')}
        </div>
      ) : shown.length === 0 ? (
        <div className="glass p-8 text-center text-sm text-stone-400">{t('dashboard.instagram.noMatch')}</div>
      ) : (
        <div className="glass overflow-hidden">
          {shown.map((c) => {
            const unread = c.unread > 0;
            const waiting = c.last_dir === 'in';
            const win = waiting ? replyWindow(c.last_in_at) : null;
            const closing = win && win.known && win.open && win.msLeft < 4 * 3600000;
            const closed = win && win.known && !win.open;
            const name = c.customer_name || (c.customer_username ? `@${c.customer_username}` : t('dashboard.instagram.customer'));
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/dashboard/instagram/${c.id}`)}
                className={`bz-inbox-row flex w-full items-center gap-3 border-b border-white/5 px-3 py-3 text-start transition last:border-0 ${unread ? 'bz-inbox-row-unread' : ''}`}
              >
                <span className="relative shrink-0">
                  {/* حلقةٌ بألوانِ إنستغرام حولَ صورةِ من كتبَ ولم يُقرأ — كقصصِ إنستغرام تماماً */}
                  <span className={`bz-igava block rounded-full p-[2.5px] ${unread ? 'is-new' : ''}`}>
                    <Avatar url={c.customer_avatar} name={c.customer_name || c.customer_username} className="bz-igava-in h-12 w-12 text-sm" />
                  </span>
                  {/* من أينَ جاءت: الصندوقُ واحدٌ والقناتانِ اثنتان، والتاجرةُ تردُّ
                      بنبرةٍ مختلفةٍ لزبونِ فيسبوكَ عن زبونةِ إنستغرام. */}
                  <span className={`bz-chat-chan absolute -bottom-0.5 -end-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-white ${c.channel === 'messenger' ? 'bz-chan-fb' : 'bz-chan-ig'}`}>
                    {c.channel === 'messenger' ? <FacebookIcon className="h-2.5 w-2.5" /> : <InstagramIcon className="h-2.5 w-2.5" />}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`truncate text-[14.5px] ${unread ? 'font-extrabold text-stone-100' : 'font-semibold text-stone-100'}`}>{name}</span>
                    {/* حالةُ طلبِها الفعليّة بلونِها، لا «صارت طلب» عامّة */}
                    {c.order_id && (c.order_status ? (
                      <span className={`bz-stbadge bz-st-${c.order_status} inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[9.5px] font-bold`}>
                        <BagIcon className="h-3 w-3" />
                        {t(`dashboard.ordersSection.${c.order_status}`)}
                      </span>
                    ) : (
                      <span className="bz-chat-ok shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold">{t('dashboard.instagram.hasOrder')}</span>
                    ))}
                    <span className={`ms-auto shrink-0 text-[11px] ${unread ? 'font-bold text-gold-300' : 'text-stone-500'}`}>{stampText(c.last_at)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={`min-w-0 flex-1 truncate text-[13px] ${unread ? 'font-semibold text-stone-200' : 'text-stone-400'}`}>
                      {(() => {
                        const card = productCard(c.last_message);
                        if (card) return `🛍️ ${t('dashboard.instagram.sentProduct', { name: card.name })}`;
                        return (
                          <>
                            {c.last_dir === 'out' && <span className="text-stone-500">{t('dashboard.instagram.youPrefix')} </span>}
                            {c.last_message || '—'}
                          </>
                        );
                      })()}
                    </span>
                    {closing && (
                      <span className="bz-inbox-warn inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold" title={t('dashboard.instagram.windowClosing')}>
                        <ClockIcon className="h-3 w-3" />
                        {t('dashboard.instagram.hoursShort', { count: Math.max(1, Math.floor(win.msLeft / 3600000)) })}
                      </span>
                    )}
                    {closed && !unread && (
                      <span className="shrink-0 text-[10px] text-stone-500" title={t('dashboard.instagram.windowClosed')}>{t('dashboard.instagram.windowEnded')}</span>
                    )}
                    {unread && (
                      <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-gold-400 px-1.5 text-[10.5px] font-bold bz-on-gold">
                        {c.unread > 99 ? '99+' : c.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ───────── حلّ عملي: تسجيل طلب من محادثة يدوياً (يعمل الآن بلا Meta) ─────────
function ManualOrderPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(null); // { reference }

  return (
    <div className="glass overflow-hidden">
      {/* عنوانٌ وزرٌّ في سطرٍ واحد، والشرحُ الطويلُ تحتَهما مطويّاً. كان الشرحُ خمسةَ
          أسطرٍ تحشو البطاقةَ فوقَ الزرِّ فيضيعُ الفعلُ بين الكلام. */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span className="dash-ico flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
            <BagIcon className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 font-display text-base font-bold text-gold-200">
            {t('dashboard.instagram.manualTitle')}
          </p>
          <button
            onClick={() => { setOpen((v) => !v); setDone(null); }}
            className="btn-primary shrink-0 gap-1 !px-3 !py-1.5 text-xs"
          >
            <PlusIcon className="h-4 w-4" /> {open ? t('common.cancel') : t('dashboard.instagram.newOrder')}
          </button>
        </div>
        <details className="group mt-2 ps-[3.25rem]">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-stone-400 transition hover:text-gold-200">
            {t('dashboard.instagram.whyManual')}
          </summary>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{t('dashboard.instagram.manualNote')}</p>
        </details>
      </div>

      {done && (
        <div className="bz-note-ok mx-4 mb-4 rounded-xl px-4 py-2.5 text-sm font-semibold">
          {t('dashboard.instagram.orderCreated')} — <span dir="ltr" className="font-mono font-bold">{done.reference}</span>
        </div>
      )}

      {open && <ManualOrderForm onDone={(reference) => { setOpen(false); setDone({ reference }); }} />}
    </div>
  );
}

// يستعمل المكوّن الموحّد، لكنه ينشئ طلباً مباشرةً عبر /orders/cod (بلا محادثة مربوطة)
function ManualOrderForm({ onDone }) {
  return (
    <div className="border-t border-white/5 bg-gold-400/5 p-3">
      <OrderComposer
        onSubmit={async (payload) => {
          const res = await api.post('/orders/cod', payload);
          try { window.dispatchEvent(new Event('bz:orders-changed')); } catch { /* تجاهل */ }
          onDone(res.data.reference || '');
        }}
      />
    </div>
  );
}
