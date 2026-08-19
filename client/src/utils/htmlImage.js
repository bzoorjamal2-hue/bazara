// تحويل قصاصة HTML إلى صورة PNG داخل المتصفّح — بلا أي مكتبة خارجية.
//
// الفكرة: نضع الـHTML داخل <foreignObject> في SVG، ونرسم الـSVG على canvas ثم
// نصدّره PNG. يعمل هذا لأن المتصفّح يرسم HTML حقيقياً داخل الـSVG، فتظهر العربية
// بتشكيلها الصحيح واتجاهها من اليمين لليسار كما على الشاشة.
//
// شرطان مهمّان: (١) الترميز يجب أن يكون XHTML صالحاً — لذلك نستخدم XMLSerializer
// على عقدة DOM حقيقية لا نصّاً مكتوباً يدوياً. (٢) لا صور خارجية داخل القصاصة،
// وإلا لوّثت الـcanvas ومنعت التصدير (فاتورتنا نصّ وحدود فقط).

/**
 * يرسم HTML كصورة PNG ويعيدها Blob.
 * @param {string} html محتوى الفاتورة
 * @param {string} css أنماطها
 * @param {number} width عرض التصميم بالبكسل
 * @param {number} scale مضاعف الدقّة (2 = صورة حادّة على شاشات الجوال)
 */
export async function htmlToPngBlob(html, css, width = 820, scale = 2) {
  // ١) نرسم القصاصة خارج الشاشة لقياس ارتفاعها الحقيقي
  const holder = document.createElement('div');
  holder.setAttribute('dir', 'rtl');
  holder.style.cssText = `position:fixed;inset-inline-start:-10000px;top:0;width:${width}px;background:#fff`;
  holder.innerHTML = `<style>${css}</style>${html}`;
  document.body.appendChild(holder);
  // قراءة scrollHeight تُجبر المتصفّح على حساب التخطيط فوراً — لا حاجة لانتظار
  // إطار رسم. (requestAnimationFrame لا يعمل أصلاً والتبويب بالخلفية فيتعلّق.)
  const height = Math.max(holder.scrollHeight, holder.getBoundingClientRect().height) + 8;

  // ٢) ترميز XHTML صالح للـforeignObject
  const serialized = new XMLSerializer().serializeToString(holder);
  holder.remove();
  const inner = serialized
    .replace(/^<div[^>]*>/, '')
    .replace(/<\/div>$/, '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<foreignObject width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="width:${width}px;background:#ffffff">${inner}</div>
</foreignObject></svg>`;

  // ٣) الرسم على canvas ثم التصدير
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  img.decoding = 'sync';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('تعذّر رسم الفاتورة كصورة.'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('تعذّر إنشاء الصورة.'))), 'image/png');
  });
}

// اسم ملف آمن على كل أنظمة التشغيل (يزيل \ / : * ? " < > | والمسافات الزائدة)
export function safeFileName(name, fallback = 'invoice') {
  const clean = String(name || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.slice(0, 80) || fallback;
}

// تنزيل Blob باسم محدّد
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
