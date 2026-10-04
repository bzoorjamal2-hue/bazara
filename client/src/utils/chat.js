// ───────── منطقُ صندوقِ الرسائل، منفصلاً عن رسمِه ─────────
//
// هذه الدوالُّ لا تعرفُ React ولا DOM، فتُختبَرُ بأمرٍ واحدٍ في Node بلا متصفّح
// (`node client/src/utils/chat.test.mjs`). كانت داخل ملفّ الشاشة فلم يكن يُختبَرُ
// منها شيء، وأخطاؤها لا تظهرُ إلّا في يدِ التاجرة.

// رسالتان متتاليتان من الطرفِ نفسِه خلال هذه المدّة تُعدّان «دفقةً» واحدة.
export const GROUP_MS = 4 * 60 * 1000;

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// قائمةُ العرض: فواصلُ الأيّام، وعلامتا أوّلِ الدفقةِ وآخرِها.
export function buildItems(messages) {
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

// نوعُ المرفقِ من امتدادِ الرابط — للصفوفِ التي سبقت عمودَ النوع.
export function guessKind(url = '') {
  const clean = String(url).split('?')[0].toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|bmp)$/.test(clean)) return 'image';
  if (/\.(mp4|mov|webm|m4v)$/.test(clean)) return 'video';
  if (/\.(mp3|m4a|ogg|wav|aac)$/.test(clean)) return 'audio';
  return '';
}

// تطبيعُ العربيّة للمقارنة: الهمزاتُ والتاءُ المربوطةُ والياءُ المقصورةُ تُكتَبُ
// بأشكالٍ مختلفةٍ لنفسِ الكلمة، والتشكيلُ والتطويلُ يزيدان الاختلاف.
export function normalizeAr(s = '') {
  return String(s)
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// رقمُ الجوّالِ من كلامِ الزبون: يُكتَبُ بمسافاتٍ وشرطاتٍ ومقدّماتٍ دوليّة.
export function findMobile(text = '') {
  const clean = String(text).replace(/[\s()\-.‎‏]/g, '');
  const m = clean.match(/(?:\+?970|00970)?(05\d{8}|5\d{8})/);
  if (!m) return '';
  return m[1].startsWith('05') ? m[1] : `0${m[1]}`;
}

// الرسالةُ الصوتيّةُ تُسجَّلُ في المتصفّحِ بما يدعمُه: سفاري mp4 وأندرويد webm.
// وإنستغرام لا تقبلُ webm، فنطلبُ من Cloudinary تسليمَها mp3 — تحويلٌ عندهم لا عندنا.
export function cldAudioMp3(url) {
  if (typeof url !== 'string' || !url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/f_mp3/').replace(/\.[a-z0-9]+(\?.*)?$/i, '.mp3');
}

// ───────── نافذةُ الأربعِ والعشرينَ ساعة ─────────
// إنستغرام وماسنجر لا يسمحان بالردِّ بعد يومٍ من آخرِ رسالةٍ كتبَها الزبون. كانت
// التاجرةُ لا تعرفُ ذلك إلّا حين يُرفَضُ ردُّها — فصارت المهلةُ تُرى قبلَ الكتابة.
export const WINDOW_MS = 24 * 60 * 60 * 1000;

// ‎{ known, open, msLeft }‎ — known=false حين لم يكتب الزبونُ شيئاً نعرفُه بعد.
export function replyWindow(lastInAt, now = Date.now()) {
  const t = lastInAt ? new Date(lastInAt).getTime() : NaN;
  if (!Number.isFinite(t)) return { known: false, open: true, msLeft: Infinity };
  const msLeft = t + WINDOW_MS - now;
  return { known: true, open: msLeft > 0, msLeft: Math.max(0, msLeft) };
}

// آخرُ ما كتبَه الزبونُ نفسُه (لا ردُّ البائعةِ الآليّة) من قائمةِ رسائل.
export function lastInboundAt(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].direction === 'in') return messages[i].created_at;
  }
  return null;
}

// ختمُ الوقتِ في قائمةِ المحادثات، بلا لغة: الواجهةُ تُترجمُه. قصيرٌ عمداً —
// «منذ ٣ ساعات» لا يتّسعُ لها السطرُ بجانبِ الاسم.
export function listStamp(iso, now = new Date()) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { kind: 'none' };
  const diff = Math.max(0, now - at);
  const min = Math.floor(diff / 60000);
  if (min < 1) return { kind: 'now' };
  if (min < 60) return { kind: 'min', value: min };
  if (sameDay(at, now)) return { kind: 'time', at };
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay(at, yest)) return { kind: 'yesterday' };
  if (diff < 6 * 24 * 60 * 60 * 1000) return { kind: 'weekday', at };
  return { kind: 'date', at };
}

// تبويباتُ الصندوق. «بانتظار ردّك» أهمُّها: آخرُ كلمةٍ للزبون ولم يُردَّ عليه بعد —
// غيرُ «غير مقروءة» التي تُصفَّرُ بمجرّدِ الفتح ولو لم يُكتَب حرف.
export function filterConvs(convs = [], { q = '', tab = 'all' } = {}) {
  const term = normalizeAr(q);
  return convs.filter((c) => {
    if (tab === 'unread' && !(c.unread > 0)) return false;
    if (tab === 'waiting' && c.last_dir !== 'in') return false;
    if (tab === 'orders' && !c.order_id) return false;
    if (!term) return true;
    return normalizeAr(`${c.customer_name || ''} ${c.customer_username || ''} ${c.last_message || ''}`).includes(term);
  });
}

// «/» في أوّلِ الصندوقِ تفتحُ الردودَ الجاهزةَ مصفّاةً بما بعدَها — أسرعُ من التمريرِ
// في الشريطِ لمن حفظت عشرين ردّاً. ‎null‎ يعني أنّ النصَّ ليس طلباً لها أصلاً.
export function matchQuick(replies = [], text = '') {
  if (!String(text).startsWith('/')) return null;
  const term = normalizeAr(String(text).slice(1));
  if (!term) return replies.slice();
  return replies.filter((r) => normalizeAr(r).includes(term));
}

// ───────── روابطُ وأرقامٌ داخلَ الرسالة ─────────
// الزبونةُ تلصقُ رابطَ منشورٍ أو منتج، أو تكتبُ رقمَها — وكانت تظهرُ نصّاً ميّتاً
// يُنسَخُ حرفاً حرفاً. نقسمُ النصَّ قطعاً: نصٌّ عاديّ، ورابطٌ يُفتَح، ورقمٌ يُتّصلُ به.
const LINK_RE = /((?:https?:\/\/|www\.)[^\s<>"'«»]+|(?:\+?970|00970)?0?5\d[\d\s-]{6,10}\d)/gi;
// علاماتُ الترقيمِ في آخرِ الرابطِ جزءٌ من الجملةِ لا منه: «شوفي هاد: https://x.com/a.»
const TRAIL_RE = /[.,!?؟،؛:)\]}]+$/;

export function linkify(text = '') {
  const s = String(text);
  const out = [];
  let last = 0;
  for (const m of s.matchAll(LINK_RE)) {
    let raw = m[0];
    const start = m.index;
    if (/^(https?:\/\/|www\.)/i.test(raw)) {
      const trail = raw.match(TRAIL_RE);
      if (trail) raw = raw.slice(0, -trail[0].length);
      if (start > last) out.push({ type: 'text', value: s.slice(last, start) });
      out.push({ type: 'url', value: raw, href: /^www\./i.test(raw) ? `https://${raw}` : raw });
      last = start + raw.length;
    } else {
      const phone = findMobile(raw);
      if (!phone) continue;
      if (start > last) out.push({ type: 'text', value: s.slice(last, start) });
      out.push({ type: 'phone', value: raw, href: `tel:${phone}` });
      last = start + raw.length;
    }
  }
  if (last < s.length) out.push({ type: 'text', value: s.slice(last) });
  return out;
}

// اسمُ الموقعِ من الرابط للبطاقةِ تحتَ الرسالة: «instagram.com» لا الرابطُ كاملاً.
// والرابطُ نفسُه يُعرَضُ مختصراً: بلا البروتوكولِ وبحدٍّ للطول — رابطُ منشورٍ كاملٌ
// بمعاملاتِ التتبّعِ يملأُ الفقاعةَ أربعةَ أسطرٍ لا تُقرأ.
export function shortUrl(url = '', max = 36) {
  const bare = String(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare;
}

export function hostOf(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
