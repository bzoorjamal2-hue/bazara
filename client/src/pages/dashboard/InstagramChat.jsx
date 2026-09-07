import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { BackIcon, BagIcon, CameraIcon, ImageIcon, TrashIcon, XIcon } from '../../components/icons.jsx';
import { uploadToCloudinary, cloudinaryEnabled, cldThumb, cldBlur, cldOptimized } from '../../utils/cloudinary.js';
import { Avatar, ConvertForm, findMobile } from './InstagramInbox.jsx';

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
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="bz-chat-viewer fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={onClose}>
      <img src={cldOptimized(url)} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
      {/* زرُّ الإغلاقِ كان شفّافاً فوقَ صورةٍ فاتحةٍ فلا يكادُ يُرى: صار قرصاً داكناً
          بحلقةٍ بيضاءَ فوقَ الصورةِ لا تحتَها، ويُقرأُ على أيِّ صورةٍ كانت. */}
      <button
        onClick={onClose}
        className="absolute end-3 top-[max(env(safe-area-inset-top),14px)] z-10 rounded-full bg-black/55 p-2.5 text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-black/75"
        aria-label={t('common.close', { defaultValue: 'إغلاق' })}
      >
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
    // إطارٌ ثابتُ المقاس: لو تُرك الارتفاعُ للصورةِ لقفزت القائمةُ تحت الإصبعِ كلّما
    // جهزت واحدة. وبلا `loading="lazy"` عمداً — الشاشةُ ترسمُ أربعين رسالةً لا مئتين،
    // والتحميلُ الكسولُ يعني فكَّ ترميزِ الصورةِ أثناءَ السحبِ نفسِه، وهي هزّةٌ تُحَسُّ
    // في الإصبع. تُحمَّلُ مع الفتحِ فيمضي السحبُ بلا عمل.
    return (
      <button
        type="button"
        onClick={() => onOpen(url)}
        style={blur ? { backgroundImage: `url(${blur})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        className="block h-[210px] w-[210px] max-w-full rounded-[14px]"
      >
        <img
          src={cldThumb(url, 480)}
          alt=""
          decoding="async"
          onError={() => setBroken(true)}
          className="block h-full w-full rounded-[14px] object-cover"
        />
      </button>
    );
  }
  if (!broken && kind === 'video') {
    return <video src={cldOptimized(url, 'video')} controls playsInline onError={() => setBroken(true)} className="block h-[210px] w-[210px] max-w-full rounded-[14px] object-cover" />;
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

// ═════════ مقياسٌ للتشخيص ═════════
// يُفتَحُ بثلاثِ نقراتٍ على صورةِ الزبونِ في الرأس. سببُه أنّ وصفَ «يتقطّع» لا يكفي
// لتحديدِ المكان: الأرقامُ تفصلُ بين ثلاثِ عللٍ مختلفةٍ تماماً —
//   fps منخفضٌ مع مهامٍّ طويلة  → جافاسكربت يشغلُ الخيطَ الرئيسيّ.
//   fps عالٍ والسحبُ يبدو ثقيلاً → المسألةُ في مسارِ اللمسِ لا في الرسم.
//   move/s كبيرٌ باللمسةِ الواحدةِ وصفرٌ بالاثنتين → مستمعُ لمسٍ يعترضُ الطريق.
function PerfHud() {
  const [s, setS] = useState({ fps: 0, moves: 0, long: 0, longMax: 0 });
  useEffect(() => {
    let frames = 0, moves = 0, long = 0, longMax = 0, raf = 0, stopped = false;
    const tick = () => { frames += 1; if (!stopped) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const onMove = () => { moves += 1; };
    document.addEventListener('touchmove', onMove, { passive: true });
    let po = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) { long += 1; longMax = Math.max(longMax, Math.round(e.duration)); }
      });
      po.observe({ entryTypes: ['longtask'] });
    } catch { /* غير مدعوم على سفاري القديم */ }
    const timer = setInterval(() => {
      setS({ fps: frames, moves, long, longMax });
      frames = 0; moves = 0;
    }, 1000);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearInterval(timer);
      document.removeEventListener('touchmove', onMove);
      if (po) po.disconnect();
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),8px)] z-[120] mx-auto w-fit rounded-full bg-black/75 px-3 py-1 font-mono text-[11px] text-white" dir="ltr">
      fps {s.fps} · move/s {s.moves} · long {s.long}/{s.longMax}ms
    </div>
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
  const dataRef = useRef(null);
  dataRef.current = data;
  const [hud, setHud] = useState(false);
  const taps = useRef([]);
  // ثلاثُ نقراتٍ على الصورةِ خلالَ ثانيةٍ تفتحُ المقياسَ وتغلقُه — بابٌ خفيٌّ لأنّه
  // للتشخيصِ لا للتاجرة، ولا يحتاجُ عنوانَ صفحةٍ يُكتَبُ في تطبيقٍ بلا شريطِ عنوان.
  const tapAvatar = () => {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((x) => now - x < 1000);
    if (taps.current.length >= 3) { taps.current = []; setHud((v) => !v); }
  };

  const load = () =>
    api.get(`/instagram/conversations/${id}/messages`)
      .then((r) => setData(r.data))
      .catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═════════ التحديثُ اللحظيّ ═════════
  // كانت التاجرةُ تُحدّثُ الصفحةَ لترى ردَّ الزبون — وهي تنتظرُه. نسألُ الخادمَ كلَّ
  // أربعِ ثوانٍ عمّا **بعدَ** آخرِ رسالةٍ عندنا فقط (لا المحادثةَ كلَّها)، ونتوقّفُ حين
  // يغيبُ التطبيقُ عن الشاشة — فلا سؤالَ ولا بطاريّةَ تُستهلَكُ وهو في الجيب.
  // ولا نسألُ أثناءَ الإرسال: الرسالةُ التفاؤليّةُ ما زالت بلا رقمٍ من الخادم.
  const sendingRef = useRef(false);
  sendingRef.current = sending;
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop || document.hidden || sendingRef.current) return;
      const msgs = dataRef.current?.messages || [];
      const last = msgs.filter((m) => !String(m.id).startsWith('tmp-')).slice(-1)[0];
      if (!last) return;
      try {
        const r = await api.get(`/instagram/conversations/${id}/messages`, { params: { after: last.created_at } });
        const fresh = r.data?.messages || [];
        if (!fresh.length || stop) return;
        setData((d) => {
          const have = new Set((d?.messages || []).map((m) => m.id));
          const add = fresh.filter((m) => !have.has(m.id));
          if (!add.length) return d;
          // نُسقطُ التفاؤليّاتِ التي عادت من الخادمِ بنصِّها نفسِه، وإلّا ظهرت مرّتين
          const texts = new Set(add.map((m) => m.text || ''));
          const kept = (d?.messages || []).filter(
            (m) => !(String(m.id).startsWith('tmp-') && texts.has(m.text || ''))
          );
          return { ...d, conversation: r.data?.conversation || d.conversation, messages: [...kept, ...add] };
        });
      } catch { /* شبكةٌ متقطّعة — نُعيد بعد أربعِ ثوانٍ */ }
    };
    const timer = setInterval(tick, 4000);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stop = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // لوحةُ المفاتيح تُقلّصُ النافذةَ المرئيّةَ ولا تُقلّصُ inset-0، فيغرقُ صندوقُ الكتابةِ
  // تحتها. كنّا نضبطُ **ارتفاعَ** الشاشةِ على ارتفاعِ النافذةِ المرئيّة، وهو خطر: أيُّ
  // قياسٍ خاطئٍ أو حدثٍ ضائعٍ (كالعودةِ من الخلفيّة) يتركُ الشاشةَ منكمشةً في أعلى
  // الجهازِ وتحتَها فراغ — وهو ما وقع. صار الحسابُ حشوةً سفليّةً بقدرِ ما تحجبُه
  // اللوحة: الشاشةُ تبقى كاملةً دائماً، وأسوأُ ما يقعُ عند خطأِ القياسِ حشوةٌ زائدةٌ
  // لا انهيارُ تخطيط.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = rootRef.current;
    if (!vv || !el) return undefined;
    let raf = 0;
    let last = -1;
    const apply = () => {
      raf = 0;
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      if (kb === last) return;
      last = kb;
      el.style.paddingBottom = kb ? `${kb}px` : '';
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    // resize يقعُ عند فتحِ اللوحةِ وإغلاقِها، وvisibilitychange عند العودةِ من الخلفيّة
    // — وهناك تكونُ القياساتُ قديمةً فتلزمُ إعادةُ الحساب.
    vv.addEventListener('resize', schedule);
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener('resize', schedule);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', schedule);
      el.style.paddingBottom = '';
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

  // لا نرسمُ المحادثةَ كلَّها: مئتا رسالةٍ تعني مئتَي عنصرٍ في الصفحة، وهاتفٌ متوسّطٌ
  // يتقطّعُ سحبُه تحتها. نرسمُ الأحدثَ فقط ونُنزلُ الأقدمَ بطلبٍ صريح — كما تفعلُ
  // تطبيقاتُ المحادثة. والزرُّ صريحٌ لا تحميلٌ عند بلوغِ الأعلى، لأنّ الإدراجَ في
  // الأعلى أثناءَ السحبِ يقفزُ بالمكانِ تحت الإصبع.
  const [limit, setLimit] = useState(40);
  const all = data?.messages || [];
  const shown = limit >= all.length ? all : all.slice(all.length - limit);
  const hasOlder = all.length > shown.length;
  const items = useMemo(() => buildItems(shown), [shown]);

  // خريطةُ المعرّفاتِ لعرضِ المقتبَس: الردُّ يحملُ معرّفَ المردودِ عليه لا نصَّه.
  const byMid = useMemo(() => {
    const map = new Map();
    for (const m of all) if (m.mid) map.set(m.mid, m);
    return map;
  }, [all]);

  // ردٌّ على رسالةٍ بعينِها، وتفاعلٌ عليها. تُفتَحُ أزرارُهما بضغطةٍ على الفقاعةِ
  // نفسِها: صفٌّ دائمٌ من الأزرارِ بجانبِ كلِّ رسالةٍ يأكلُ العرضَ ويشوّشُ القراءة.
  const [activeId, setActiveId] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { mid, text }

  const react = async (m) => {
    if (!m.mid) return;
    const next = m.reaction ? '' : 'love';
    setActiveId('');
    setData((d) => ({
      ...d,
      messages: (d?.messages || []).map((x) => (x.id === m.id ? { ...x, reaction: next } : x)),
    }));
    try {
      await api.post(`/instagram/conversations/${id}/react`, { mid: m.mid, reaction: next });
    } catch (e) {
      setError(getErrorMessage(e));
      setData((d) => ({
        ...d,
        messages: (d?.messages || []).map((x) => (x.id === m.id ? { ...x, reaction: m.reaction || '' } : x)),
      }));
    }
  };

  // نصٌّ مختصرٌ للمقتبَس: الصورةُ بلا نصٍّ تُوصَفُ بكلمةٍ بدل أن تظهرَ فارغة
  const quoteText = (m) => (m?.text || '').trim() || (m?.attachment_url ? '📷' : '…');

  // ما قاله الزبونُ نفسُه: منه نلتقطُ رقمَه ومنتجاتِه ومكانَه لنملأَ نموذجَ الطلب.
  // كلامُ التاجرةِ لا يدخلُ هنا — رقمُها هي ليس رقمَ الزبون.
  const custText = useMemo(
    () => all.filter((m) => m.direction === 'in').map((m) => m.text || '').join(' \n '),
    [all],
  );
  const guessedPhone = useMemo(() => findMobile(custText), [custText]);

  // إنزالُ الأقدمِ يُبقي ما تقرؤه في مكانِه: نقيسُ الطولَ قبلَ الزيادةِ وبعدَها ونعوّضُ
  // الفرق، وإلّا قفزت الشاشةُ إلى أوّلِ المحادثةِ فجأة.
  const loadOlder = () => {
    const el = scrollRef.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    setLimit((n) => n + 60);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  };

  // الحركةُ للرسالةِ الجديدةِ وحدَها: تشغيلُ مئةِ حركةٍ دفعةً واحدةً عند الفتحِ ثقيلٌ
  // بلا فائدة — فلا أحدَ ينتظرُ ظهورَ رسالةٍ عمرُها يومان.
  const mounted = useRef(null);
  if (mounted.current === null && all.length) mounted.current = new Set(all.map((m) => m.id));
  const isNew = (mid) => Boolean(mounted.current && !mounted.current.has(mid));

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
      await api.post(`/instagram/conversations/${id}/reply`, {
        text: body,
        attachmentUrl: uploaded,
        replyToMid: replyTo?.mid || '',
      });
      setReplyTo(null);
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
  const seenAt = c.seen_at;
  // آخرُ رسالةٍ صادرةٍ في المحادثة كلِّها — تحتَها وحدَها تُكتَبُ «شوهدت»
  const lastOutId = useMemo(() => {
    for (let i = all.length - 1; i >= 0; i -= 1) if (all[i].direction === 'out') return all[i].id;
    return '';
  }, [all]);
  const isLastOut = (m) => m.id === lastOutId;
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
        <button type="button" onClick={tapAvatar} className="shrink-0" aria-hidden>
          <Avatar url={c.customer_avatar} name={name} className="h-9 w-9 text-xs" />
        </button>
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
            defaultPhone={guessedPhone}
            hintText={custText}
            onDone={(orderId) => { setShowConvert(false); setData((d) => ({ ...d, conversation: { ...d.conversation, order_id: orderId } })); }}
          />
        </div>
      )}

      {/* الرسائل */}
      <div ref={scrollRef} className="bz-chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3">
        {!data ? (
          <Spinner />
        ) : items.length === 0 ? (
          <p className="bz-chat-muted my-auto text-center text-sm">{t('dashboard.instagram.noMessages')}</p>
        ) : (
          <>
          {hasOlder && (
            <button onClick={loadOlder} className="bz-chat-day mx-auto mb-3 rounded-full px-4 py-1.5 text-[11px] font-semibold">
              {t('dashboard.instagram.older')}
            </button>
          )}
          {items.map((it) => {
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
                <div className="min-w-0 max-w-[76%]">
                  <div
                    onClick={(e) => {
                      // الصورةُ والفيديو والروابطُ لها فعلُها، فلا نخطفُ ضغطتَها
                      if (e.target.closest('button, a, video, audio')) return;
                      setActiveId((v) => (v === m.id ? '' : m.id));
                    }}
                    className={`relative ${isNew(m.id) ? 'bz-bubble' : ''} ${out ? 'bz-chat-out' : 'bz-chat-in'} ${media ? 'p-1' : 'px-3 py-1.5'} rounded-[18px]`}
                  >
                    {/* المقتبَس: ردٌّ بلا ما رُدَّ عليه نصفُ كلام */}
                    {m.reply_to_mid && byMid.get(m.reply_to_mid) && (
                      <div className="bz-chat-quote mb-1 truncate rounded-lg px-2 py-1 text-[11px]">
                        {quoteText(byMid.get(m.reply_to_mid))}
                      </div>
                    )}
                    {media && <Attachment url={m.attachment_url} type={m.attachment_type} onOpen={setViewing} />}
                    {m.text && <p className={`whitespace-pre-wrap break-words text-[14px] leading-[1.45] ${media ? 'px-2 pb-1 pt-1.5' : ''}`}>{m.text}</p>}
                    {it.last && (
                      <span className={`bz-chat-time mt-0.5 block text-[10px] leading-none ${media ? 'px-2 pb-1.5' : 'pb-0.5'} ${out ? 'text-start' : 'text-end'}`}>
                        {timeOf(m)}
                      </span>
                    )}
                    {/* التفاعلُ يجلسُ على حافّةِ الفقاعةِ كما في تطبيقاتِ المحادثة */}
                    {m.reaction && (
                      <span className="bz-chat-react absolute -bottom-2 end-2 rounded-full px-1 text-[11px] leading-none">❤️</span>
                    )}
                  </div>

                  {/* أزرارُ الرسالةِ تحتَها عند اختيارِها — لا صفٌّ دائمٌ يأكلُ العرض */}
                  {activeId === m.id && (
                    <div className={`mt-1 flex gap-1.5 ${out ? 'justify-start' : 'justify-end'}`}>
                      <button
                        onClick={() => { setReplyTo({ mid: m.mid, text: quoteText(m) }); setActiveId(''); }}
                        disabled={!m.mid}
                        className="bz-chat-day rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
                      >
                        {t('dashboard.instagram.reply')}
                      </button>
                      <button
                        onClick={() => react(m)}
                        disabled={!m.mid}
                        className="bz-chat-day rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
                      >
                        {m.reaction ? t('dashboard.instagram.unreact') : '❤️'}
                      </button>
                    </div>
                  )}

                  {/* «شوهدت» تحت آخرِ ما أرسلناه فقط — تكرارُها تحت كلِّ رسالةٍ ضجيج */}
                  {out && it.last && isLastOut(m) && seenAt && new Date(seenAt) >= new Date(m.created_at) && (
                    <span className="bz-chat-muted mt-0.5 block text-start text-[10px]">{t('dashboard.instagram.seen')}</span>
                  )}
                </div>
                {/* صورةُ الزبونِ في طرفِ الشاشةِ الخارجيِّ ومرّةً واحدةً في آخرِ دفقتِه —
                    لا مع كلِّ سطر. والمكانُ محجوزٌ في باقي الدفقةِ لتبقى الفقاعاتُ مصطفّة. */}
                {!out && (it.last
                  ? <Avatar url={c.customer_avatar} name={name} className="h-6 w-6 text-[10px]" />
                  : <span className="h-6 w-6 shrink-0" />)}
              </div>
            );
          })}
          </>
        )}
      </div>

      {error && <div className="bz-chat-err mx-3 mb-2 shrink-0 rounded-xl px-3 py-2 text-xs">{error}</div>}

      {/* المقتبَسُ فوقَ صندوقِ الكتابة: يجبُ أن يرى المرسِلُ على ماذا يردّ */}
      {replyTo && (
        <div className="bz-chat-in mx-3 mb-2 flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2">
          <span className="bz-chat-muted shrink-0 text-[11px] font-semibold">{t('dashboard.instagram.replyingTo')}</span>
          <span className="min-w-0 flex-1 truncate text-xs">{replyTo.text}</span>
          <button onClick={() => setReplyTo(null)} className="bz-chat-icon shrink-0 rounded-full p-1" aria-label={t('common.cancel')}>
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

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

      {hud && <PerfHud />}
      {viewing && <ImageViewer url={viewing} onClose={() => setViewing('')} />}
    </div>,
    document.body
  );
}
