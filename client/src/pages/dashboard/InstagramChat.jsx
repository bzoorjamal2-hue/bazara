import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { BackIcon, BagIcon, CameraIcon, ImageIcon, TrashIcon, XIcon } from '../../components/icons.jsx';
import { uploadToCloudinary, cloudinaryEnabled, cldThumb, cldBlur, cldOptimized } from '../../utils/cloudinary.js';
import { Avatar, ConvertForm } from './InstagramInbox.jsx';

// ═════════ شاشةُ محادثةٍ واحدة ═════════
// المحادثةُ صفحةٌ قائمةٌ بذاتها تُرسَمُ على body: رأسٌ في الأعلى، ورسائلٌ تملأُ ما
// بينهما، وصندوقُ كتابةٍ ملتصقٌ بالأسفل — كما في كلِّ تطبيقِ محادثة.

// رسالتان متتاليتان من الطرفِ نفسِه خلال هذه المدّة تُعدّان «دفقةً» واحدة: تتقاربان
// وتُختَمُ الدفقةُ بوقتٍ واحدٍ وصورةٍ واحدة. بلا هذا يصيرُ لكلِّ كلمةٍ صندوقٌ ووقتٌ
// وصورة، فتطولُ الشاشةُ بلا معنى — وهو ما كان.
const GROUP_MS = 4 * 60 * 1000;

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// نبني قائمةَ العرض مرّةً واحدة: فواصلُ الأيّام، وعلاماتُ أوّلِ الدفقةِ وآخرِها.
function buildItems(messages) {
  const out = [];
  let prev = null;
  messages.forEach((m, i) => {
    const at = new Date(m.created_at);
    if (!prev || !sameDay(new Date(prev.created_at), at)) {
      out.push({ type: 'day', key: 'd' + m.id, at });
    }
    const next = messages[i + 1];
    const contWithPrev = prev && prev.direction === m.direction
      && sameDay(new Date(prev.created_at), at)
      && at - new Date(prev.created_at) < GROUP_MS;
    const contWithNext = next && next.direction === m.direction
      && sameDay(new Date(next.created_at), at)
      && new Date(next.created_at) - at < GROUP_MS;
    out.push({ type: 'msg', key: m.id, m, first: !contWithPrev, last: !contWithNext });
    prev = m;
  });
  return out;
}

// عارضُ الصورة: الضغطُ على صورةٍ في المحادثة كان يفتحُ تبويباً جديداً — وفي تطبيقٍ
// مثبَّتٍ (PWA) لا تبويبَ يُفتَح، فبدت الصورُ وكأنّها لا تفتح. صارت تكبرُ في مكانها.
function ImageViewer({ url, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="bz-chat-viewer fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={onClose}>
      <img src={cldOptimized(url)} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
      <button onClick={onClose} className="absolute end-4 top-[max(env(safe-area-inset-top),16px)] rounded-full bg-white/15 p-2 text-white backdrop-blur transition hover:bg-white/25" aria-label="close">
        <XIcon className="h-5 w-5" />
      </button>
    </div>,
    document.body
  );
}

// المرفقُ يظهرُ بصورتِه: صورةٌ تُعرَضُ وتكبر، وفيديو يُشغَّل، وصوتٌ يُسمَعُ في مكانه.
// الصورُ منسوخةٌ عندنا على Cloudinary، فنطلبُ مقاسَ العرضِ لا الأصلَ الكامل — وخلفَها
// نسخةٌ ضبابيّةٌ تصلُ في أجزاءٍ من الثانية بدل مربّعٍ فارغٍ يقفزُ حين تجهزُ الصورة.
function Attachment({ url, type, onOpen }) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  const kind = type === 'ig_reel' ? 'video'
    : (type === 'share' || type === 'story_mention') ? 'image'
    : (type || guessKind(url) || 'image');

  if (!broken && kind === 'image') {
    const blur = cldBlur(url);
    return (
      <button type="button" onClick={() => onOpen(url)} className="block w-full overflow-hidden rounded-[14px]">
        <img
          src={cldThumb(url, 640)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          style={blur ? { backgroundImage: `url(${blur})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          className="block max-h-[300px] w-full object-cover"
        />
      </button>
    );
  }
  if (!broken && kind === 'video') {
    return <video src={cldOptimized(url, 'video')} controls playsInline onError={() => setBroken(true)} className="block max-h-[300px] w-full rounded-[14px]" />;
  }
  if (!broken && kind === 'audio') {
    return <audio src={url} controls onError={() => setBroken(true)} className="w-[210px] max-w-full" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
      📎 {t('dashboard.instagram.attachment')}
    </a>
  );
}

// الصفوفُ القديمةُ سبقت عمودَ النوع، وروابطُ Meta بلا امتدادٍ يُستدَلُّ به.
function guessKind(url = '') {
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|bmp)$/.test(clean)) return 'image';
  if (/\.(mp4|mov|webm|m4v)$/.test(clean)) return 'video';
  if (/\.(mp3|m4a|ogg|wav|aac)$/.test(clean)) return 'audio';
  return '';
}

export default function InstagramChat() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const scrollRef = useRef(null);

  const [data, setData] = useState(null); // { conversation, messages }
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showConvert, setShowConvert] = useState(false);
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [progress, setProgress] = useState(0);
  const [viewing, setViewing] = useState('');

  const load = () =>
    api.get(`/instagram/conversations/${id}/messages`)
      .then((r) => setData(r.data))
      .catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // لوحةُ المفاتيح تُقلّصُ النافذةَ المرئيّةَ ولا تُقلّصُ inset-0، فيغرقُ صندوقُ الكتابة
  // تحتها. نقيسُ النافذةَ المرئيّةَ نفسَها فتبقى الكتابةُ فوقَ اللوحةِ دائماً.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = rootRef.current;
    if (!vv || !el) return undefined;
    const apply = () => {
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, []);

  // الصنفُ يُخفي شريطَ التبويباتِ السفليَّ ويمنعُ الصفحةَ تحتَنا من التمرير — وبلا
  // المنعِ كان هيدرُ الموقعِ يظهرُ من فوقِ المحادثةِ كلّما تحرّكت الصفحةُ خلفَها.
  useEffect(() => {
    document.body.classList.add('bz-chat-open');
    return () => document.body.classList.remove('bz-chat-open');
  }, []);

  // آخرُ رسالةٍ هي المقصودةُ دائماً: نزولٌ فوريٌّ عند الفتح، وسلسٌ بعد كلِّ إرسال.
  const firstScroll = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? 'auto' : 'smooth' });
    if (data?.messages) firstScroll.current = false;
  }, [data?.messages?.length]);

  const items = useMemo(() => buildItems(data?.messages || []), [data?.messages]);

  const pick = (file) => {
    if (!file) return;
    setError('');
    setPhoto((old) => {
      if (old?.preview) URL.revokeObjectURL(old.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
  };
  const dropPhoto = () => setPhoto((old) => {
    if (old?.preview) URL.revokeObjectURL(old.preview);
    return null;
  });

  const send = async () => {
    const body = text.trim();
    if (!body && !photo) return;
    setSending(true); setError('');

    // الصورةُ تُرفَعُ أوّلاً لأنّ إنستغرام تطلبُ رابطاً عامّاً تجلبُه بنفسها، لا ملفّاً
    // نرسلُه إليها. وفشلُ الرفعِ يوقفُ كلَّ شيءٍ قبل أن نُظهرَ رسالةً لم تُرسَل.
    let uploaded = '';
    if (photo) {
      try {
        setProgress(1);
        uploaded = await uploadToCloudinary(photo.file, 'image', setProgress);
      } catch (e) {
        setError(getErrorMessage(e));
        setSending(false); setProgress(0);
        return;
      }
    }

    const stamp = Date.now();
    const optimistic = [];
    if (uploaded) optimistic.push({ id: 'tmp-img-' + stamp, direction: 'out', text: '', attachment_url: uploaded, attachment_type: 'image', created_at: new Date().toISOString() });
    if (body) optimistic.push({ id: 'tmp-txt-' + stamp, direction: 'out', text: body, created_at: new Date().toISOString() });
    setData((d) => ({ ...d, messages: [...(d?.messages || []), ...optimistic] }));
    const keptPhoto = photo;
    setText(''); dropPhoto(); setProgress(0);

    try {
      await api.post(`/instagram/conversations/${id}/reply`, { text: body, attachmentUrl: uploaded });
    } catch (e) {
      setError(getErrorMessage(e));
      const ids = new Set(optimistic.map((m) => m.id));
      setData((d) => ({ ...d, messages: (d?.messages || []).filter((m) => !ids.has(m.id)) }));
      setText(body);
      if (keptPhoto) setPhoto(keptPhoto);
    } finally {
      setSending(false);
    }
  };

  const c = data?.conversation || {};
  const name = c.customer_name || (c.customer_username ? `@${c.customer_username}` : t('dashboard.instagram.customer'));
  const converted = Boolean(c.order_id);
  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  const dayLabel = (at) => {
    const today = new Date();
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    if (sameDay(at, today)) return t('common.today', { defaultValue: locale === 'ar' ? 'اليوم' : 'Today' });
    if (sameDay(at, yest)) return t('common.yesterday', { defaultValue: locale === 'ar' ? 'أمس' : 'Yesterday' });
    return at.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  };
  const timeOf = (m) => new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return createPortal(
    <div ref={rootRef} className="bz-chat fixed inset-0 z-[95] flex flex-col">
      {/* رأسُ المحادثة */}
      <header className="bz-chat-bar flex shrink-0 items-center gap-2.5 border-b px-2 pb-2 pt-[max(env(safe-area-inset-top),10px)]">
        <button onClick={() => navigate('/dashboard?tab=instagram')} className="bz-chat-icon rounded-full p-2 transition" aria-label={t('common.back')}>
          <BackIcon className="h-5 w-5" />
        </button>
        <Avatar url={c.customer_avatar} name={name} className="h-9 w-9 text-xs" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[15px] font-semibold">{name}</span>
          {c.customer_username && <span dir="ltr" className="bz-chat-muted block truncate text-[11px]">@{c.customer_username}</span>}
        </span>
        {converted ? (
          <span className="bz-chat-ok shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">{t('dashboard.instagram.hasOrder')}</span>
        ) : (
          <button onClick={() => setShowConvert((v) => !v)} className="btn-primary shrink-0 !gap-1 !rounded-full !px-3 !py-1.5 text-xs">
            <BagIcon className="h-4 w-4" /> {showConvert ? t('common.cancel') : t('dashboard.instagram.toOrder')}
          </button>
        )}
      </header>

      {showConvert && !converted && (
        <div className="bz-chat-bar max-h-[60%] shrink-0 overflow-y-auto border-b">
          <ConvertForm
            convId={id}
            defaultName={c.customer_name || ''}
            onDone={(orderId) => { setShowConvert(false); setData((d) => ({ ...d, conversation: { ...d.conversation, order_id: orderId } })); }}
          />
        </div>
      )}

      {/* الرسائل */}
      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-3">
        {!data ? (
          <Spinner />
        ) : items.length === 0 ? (
          <p className="bz-chat-muted my-auto text-center text-sm">{t('dashboard.instagram.noMessages')}</p>
        ) : (
          items.map((it) => {
            if (it.type === 'day') {
              return (
                <div key={it.key} className="my-3 flex justify-center">
                  <span className="bz-chat-day rounded-full px-3 py-1 text-[11px] font-semibold">{dayLabel(it.at)}</span>
                </div>
              );
            }
            const m = it.m;
            const out = m.direction === 'out';
            const media = Boolean(m.attachment_url);
            return (
              <div key={it.key} className={`flex items-end gap-1.5 ${out ? 'justify-start' : 'justify-end'} ${it.last ? 'mb-2.5' : 'mb-[3px]'}`}>
                <div className={`bz-bubble max-w-[76%] ${out ? 'bz-chat-out' : 'bz-chat-in'} ${media ? 'overflow-hidden p-1' : 'px-3 py-1.5'} rounded-[18px]`}>
                  {media && <Attachment url={m.attachment_url} type={m.attachment_type} onOpen={setViewing} />}
                  {m.text && <p className={`whitespace-pre-wrap break-words text-[14px] leading-[1.45] ${media ? 'px-2 pb-1 pt-1.5' : ''}`}>{m.text}</p>}
                  {it.last && (
                    <span className={`bz-chat-time block text-[10px] leading-none ${media ? 'px-2 pb-1.5' : 'pb-0.5'} ${out ? 'text-start' : 'text-end'}`}>
                      {timeOf(m)}
                    </span>
                  )}
                </div>
                {/* صورةُ الزبونِ في طرفِ الشاشةِ الخارجيِّ ومرّةً واحدةً في آخرِ دفقتِه —
                    لا مع كلِّ سطر. والمكانُ محجوزٌ في باقي الدفقةِ لتبقى الفقاعاتُ مصطفّة. */}
                {!out && (it.last
                  ? <Avatar url={c.customer_avatar} name={name} className="h-6 w-6 text-[10px]" />
                  : <span className="h-6 w-6 shrink-0" />)}
              </div>
            );
          })
        )}
      </div>

      {error && <div className="bz-chat-err mx-3 mb-2 shrink-0 rounded-xl px-3 py-2 text-xs">{error}</div>}

      {/* معاينةُ الصورةِ قبل الإرسال — لا تُرسَلُ صورةٌ لم يرَها المُرسِل */}
      {photo && (
        <div className="bz-chat-in mx-3 mb-2 flex shrink-0 items-center gap-3 rounded-2xl p-2">
          <img src={photo.preview} alt="" className="h-14 w-14 rounded-xl object-cover" />
          <span className="bz-chat-muted min-w-0 flex-1 text-xs">
            {sending && progress > 0 ? `${t('dashboard.instagram.uploading')} ${progress}%` : t('dashboard.instagram.photoReady')}
          </span>
          <button onClick={dropPhoto} disabled={sending} className="bz-chat-icon rounded-full p-1.5 transition hover:text-red-400 disabled:opacity-40" aria-label={t('common.delete')}>
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* صندوقُ الكتابة */}
      <div className="bz-chat-bar flex shrink-0 items-center gap-1 border-t px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2">
        {cloudinaryEnabled && (
          <>
            {/* زرّان لا واحد: المعرضُ يفتحُ الصورَ المحفوظة، والكاميرا تفتحُ العدسةَ
                مباشرةً على الجوّال (capture) — وهو ما يتوقّعه من اعتاد إنستغرام. */}
            <label className="bz-chat-icon shrink-0 cursor-pointer rounded-full p-2 transition" title={t('dashboard.instagram.attachPhoto')}>
              <ImageIcon className="h-[22px] w-[22px]" />
              <input type="file" accept="image/*" className="hidden" disabled={sending}
                onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <label className="bz-chat-icon shrink-0 cursor-pointer rounded-full p-2 transition sm:hidden" title={t('dashboard.instagram.takePhoto')}>
              <CameraIcon className="h-[22px] w-[22px]" />
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={sending}
                onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </>
        )}
        <textarea
          className="bz-chat-input min-h-[40px] flex-1 resize-none"
          rows={1}
          placeholder={t('dashboard.instagram.replyPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={send} disabled={sending || (!text.trim() && !photo)} className="btn-primary shrink-0 !rounded-full !px-4 !py-2 text-sm disabled:opacity-40">
          {sending ? t('common.loading') : t('dashboard.instagram.send')}
        </button>
      </div>

      {viewing && <ImageViewer url={viewing} onClose={() => setViewing('')} />}
    </div>,
    document.body
  );
}
