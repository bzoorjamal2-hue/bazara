// حماية: أي صورة تدخل كـ base64 مضمّنة (data:image/...) نرفعها تلقائياً إلى Cloudinary
// ونعيد الرابط الخفيف — كي لا تُخزَّن صور ضخمة في قاعدة البيانات فتثقّل كل الصفحات.
// يستخدم نفس الإعدادات العامة (preset غير موقّع) المعتمدة في الواجهة.
const CLOUD = process.env.CLOUDINARY_CLOUD || 'dkzrnu4cs';
const PRESET = process.env.CLOUDINARY_PRESET || 'bazara_unsigned';

export async function toHostedUrl(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v.startsWith('data:image/')) return value; // رابط جاهز أو فارغ → بلا تغيير
  try {
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
