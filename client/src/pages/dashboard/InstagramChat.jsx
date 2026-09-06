import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { BackIcon, BagIcon, CameraIcon, ImageIcon, TrashIcon } from '../../components/icons.jsx';
import { uploadToCloudinary, cloudinaryEnabled } from '../../utils/cloudinary.js';
import { Avatar, Attachment, ConvertForm } from './InstagramInbox.jsx';

// ═════════ شاشةُ محادثةٍ واحدة ═════════
// المحادثةُ صفحةٌ قائمةٌ بذاتها لا لوحٌ ينفتح داخل التبويب: عنوانٌ في الأعلى، ورسائلٌ
// تملأُ ما بينهما، وصندوقُ كتابةٍ ملتصقٌ بالأسفل — كما في كلِّ تطبيقِ محادثة. ولذلك
// تُغطّي الشاشةَ كاملةً (fixed inset-0) بدل أن تجلسَ داخل صفحةِ اللوحة المحشوّة.
export default function InstagramChat() {
  const { t } = useTranslation();
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

  const load = () =>
    api.get(`/instagram/conversations/${id}/messages`)
      .then((r) => setData(r.data))
      .catch((e) => setError(getErrorMessage(e)));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // لوحةُ المفاتيح تُقلّصُ النافذةَ المرئيّةَ ولا تُقلّصُ inset-0، فيغرقُ صندوقُ الكتابة
  // تحتها ويقفزُ ما دونَه إلى وسطِ الشاشة. نقيسُ النافذةَ المرئيّةَ نفسَها فتبقى
  // الكتابةُ فوقَ اللوحةِ دائماً — وهو ما يفعله كلُّ تطبيقِ محادثة.
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

  // الصنفُ يفعلُ شيئين: يُخفي شريطَ التبويباتِ السفليَّ (مثبَّتٌ بـfixed فيطفو فوقَ
  // كلِّ شيء)، ويمنعُ الصفحةَ تحتَنا من التمرير — وبلا المنعِ كان هيدرُ الموقعِ يظهرُ
  // من فوقِ المحادثةِ كلّما تحرّكت الصفحةُ خلفَها.
  useEffect(() => {
    document.body.classList.add('bz-chat-open');
    return () => document.body.classList.remove('bz-chat-open');
  }, []);

  // آخرُ رسالةٍ هي المقصودةُ دائماً، فالفتحُ والإرسالُ ينزلان إليها.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.messages?.length]);

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

    // تفاؤليّاً — نُظهرُ ما أُرسل فوراً بنفس ترتيبِ الخادم: الصورةُ ثمّ النصّ.
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

  // تُرسَمُ الشاشةُ على body مباشرةً لا داخلَ شجرةِ اللوحة: هناك يحكمُها ترتيبُ الطبقاتِ
  // في الصفحةِ وقصُّ `overflow` في غلافِها، فيبقى هيدرُ الموقعِ ظاهراً فوقَها. وعلى body
  // لا يعلوها شيء. وألوانُها معرَّفةٌ بـhtml.dark لا بـ`.theme-pub`، فلا يضيرُها الخروجُ
  // من غلافِ الثيم.
  return createPortal(
    <div ref={rootRef} className="bz-chat fixed inset-0 z-[95] flex flex-col">
      {/* رأسُ المحادثة */}
      <header className="bz-chat-bar flex shrink-0 items-center gap-2 border-b px-2 pb-2.5 pt-[max(env(safe-area-inset-top),10px)]">
        <button onClick={() => navigate('/dashboard?tab=instagram')} className="bz-chat-icon rounded-lg p-2 transition" aria-label={t('common.back')}>
          <BackIcon className="h-5 w-5" />
        </button>
        <Avatar url={c.customer_avatar} name={name} className="h-9 w-9 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          {c.customer_username && <span dir="ltr" className="bz-chat-muted block truncate text-[11px]">@{c.customer_username}</span>}
        </span>
        {converted ? (
          <span className="bz-chat-ok shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">{t('dashboard.instagram.hasOrder')}</span>
        ) : (
          <button onClick={() => setShowConvert((v) => !v)} className="btn-primary shrink-0 !gap-1 !px-3 !py-1.5 text-xs">
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
      <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
        {!data ? (
          <Spinner />
        ) : data.messages.length === 0 ? (
          <p className="bz-chat-muted my-auto text-center text-sm">{t('dashboard.instagram.noMessages')}</p>
        ) : (
          data.messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${m.direction === 'out' ? 'bz-chat-out' : 'bz-chat-in'}`}>
                {m.attachment_url ? <Attachment url={m.attachment_url} type={m.attachment_type} /> : null}
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                <span className="bz-chat-time mt-0.5 block text-[10px]">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {error && <div className="bz-chat-err mx-3 mb-2 shrink-0 rounded-xl px-3 py-2 text-xs">{error}</div>}

      {/* معاينةُ الصورةِ قبل الإرسال — لا تُرسَلُ صورةٌ لم يرَها المُرسِل */}
      {photo && (
        <div className="bz-chat-in mx-3 mb-2 flex shrink-0 items-center gap-3 rounded-xl p-2">
          <img src={photo.preview} alt="" className="h-14 w-14 rounded-lg object-cover" />
          <span className="bz-chat-muted min-w-0 flex-1 text-xs">
            {sending && progress > 0 ? `${t('dashboard.instagram.uploading')} ${progress}%` : t('dashboard.instagram.photoReady')}
          </span>
          <button onClick={dropPhoto} disabled={sending} className="bz-chat-icon rounded-lg p-1.5 transition hover:text-red-400 disabled:opacity-40" aria-label={t('common.delete')}>
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* صندوقُ الكتابة */}
      <div className="bz-chat-bar flex shrink-0 items-end gap-2 border-t px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        {cloudinaryEnabled && (
          <>
            {/* زرّان لا واحد: المعرضُ يفتحُ الصورَ المحفوظة، والكاميرا تفتحُ العدسةَ
                مباشرةً على الجوّال (capture) — وهو ما يتوقّعه من اعتاد إنستغرام. */}
            <label className="bz-chat-icon shrink-0 cursor-pointer rounded-xl p-2.5 transition" title={t('dashboard.instagram.attachPhoto')}>
              <ImageIcon className="h-5 w-5" />
              <input type="file" accept="image/*" className="hidden" disabled={sending}
                onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <label className="bz-chat-icon shrink-0 cursor-pointer rounded-xl p-2.5 transition sm:hidden" title={t('dashboard.instagram.takePhoto')}>
              <CameraIcon className="h-5 w-5" />
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={sending}
                onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </>
        )}
        <textarea
          className="input min-h-[42px] flex-1 resize-none"
          rows={1}
          placeholder={t('dashboard.instagram.replyPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={send} disabled={sending || (!text.trim() && !photo)} className="btn-primary shrink-0 !px-4 !py-2.5 text-sm disabled:opacity-50">
          {sending ? t('common.loading') : t('dashboard.instagram.send')}
        </button>
      </div>
    </div>,
    document.body
  );
}
