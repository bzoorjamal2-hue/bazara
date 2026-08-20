// ما الذي أفلتَته المستخدمة فعلاً؟
//
// الاعتماد على file.type وحده يرفض ملفات صحيحة: كثير من المصادر على ويندوز
// (مدير ملفات، مرفق برنامج، ملف خارج من أرشيف) تُسلّم الملف بنوع MIME فارغ،
// فيسقط فحص type.startsWith('image/') ويُقال للمالكة «الملف المختار ليس صورة»
// وهي تنظر إلى صورتها. الامتداد مرجعٌ ثانٍ حين يصمت النوع.

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'heic', 'heif', 'jfif', 'svg'];
const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv', '3gp', 'qt'];

const extOf = (name) => String(name || '').split('.').pop().toLowerCase();

// kind: 'image' | 'video'
export function isKind(file, kind) {
  if (!file) return false;
  const type = file.type || '';
  if (type.startsWith(`${kind}/`)) return true;
  // نوع فارغ أو عامّ (application/octet-stream) → نحتكم للامتداد
  if (!type || type === 'application/octet-stream') {
    return (kind === 'image' ? IMAGE_EXT : VIDEO_EXT).includes(extOf(file.name));
  }
  return false;
}

// رابط صورة/فيديو مسحوب من صفحة ويب أخرى: لا ملف في dataTransfer إطلاقاً،
// بل رابط في text/uri-list. كان الإفلات في هذه الحالة لا يفعل شيئاً بصمت.
export function droppedUrl(dataTransfer) {
  if (!dataTransfer || typeof dataTransfer.getData !== 'function') return '';
  const raw = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain') || '';
  // text/uri-list قد يحمل أكثر من سطر وتعليقات تبدأ بـ#
  const url = raw.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#')) || '';
  return /^https?:\/\//i.test(url) ? url : '';
}
