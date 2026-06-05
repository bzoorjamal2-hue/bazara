// يصغّر الصورة المرفوعة في المتصفح ويحوّلها إلى data URL (base64)
// حتى تُخزَّن مباشرة في قاعدة البيانات بدون خدمة تخزين خارجية.
export function resizeImageFile(file, { maxSize = 900, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('الملف ليس صورة.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذّر قراءة الصورة.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('تعذّر تحميل الصورة.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
