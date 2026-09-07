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
