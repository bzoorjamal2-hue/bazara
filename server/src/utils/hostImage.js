// حماية: أي صورة تدخل كـ base64 مضمّنة (data:image/...) نرفعها تلقائياً ونعيد الرابط
// الخفيف — كي لا تُخزَّن صور ضخمة في قاعدة البيانات فتثقّل كل الصفحات.
//
// محرّكُ بازارا (R2) أوّلاً إن كان مُعدّاً، وإلّا كلاوديناري كما كان. والصورةُ هنا تُحفَظُ
// باسم ‎o.<ext> لا بأسماءِ المقاسات (1600…): الخادمُ لا يُصغِّر، فلو حملت اسمَ مقاسٍ لطلبت
// الواجهةُ مقاساتٍ أخرى غيرَ موجودة. الاسمُ ‎o لا يطابقُ نمطَ المقاسات فيُعرَضُ كما هو.
import crypto from 'crypto';
import { r2Enabled, putObject } from './r2.js';

const CLOUD = process.env.CLOUDINARY_CLOUD || 'dkzrnu4cs';
const PRESET = process.env.CLOUDINARY_PRESET || 'bazara_unsigned';
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

export async function toHostedUrl(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v.startsWith('data:image/')) return value; // رابط جاهز أو فارغ → بلا تغيير
  try {
    if (r2Enabled()) {
      const m = v.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
      const ext = m && EXT[m[1].toLowerCase()];
      if (!ext) return value;
      const id = crypto.randomBytes(16).toString('hex');
      return await putObject(`i/${id}/o.${ext}`, Buffer.from(m[2], 'base64'), m[1].toLowerCase());
    }
    const form = new URLSearchParams();
    form.append('file', v);
    form.append('upload_preset', PRESET);
    const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: form });
    const data = await resp.json();
    return data?.secure_url || value; // فشل الرفع → نُبقي القيمة الأصلية كي لا نكسر الحفظ
  } catch {
    return value;
  }
}
