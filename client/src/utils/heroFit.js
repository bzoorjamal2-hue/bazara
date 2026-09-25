// ملاءمة وسيط الهيرو لصندوقه.
//
// فيديوهات التاجرات من جوّالاتهنّ: طوليّة، ٧٢٠ بكسلاً عرضاً بعد المعالجة. والهيرو على
// الكمبيوتر عريض — فالقصّ ليملأه (object-cover) يمدّ الـ٧٢٠ إلى ٢٥٦٠: تكبيرٌ ٣٫٥ مرّات،
// وهو الغبش الذي تراه التاجرة على شاشتها («فيديوهات الهيرو مش واضحة مغبّشة»).
//
// حين يحتاج الملء تكبيراً فوق ١٫٦ مرّة نعرض الوسيط كاملاً بوسط الصندوق بدقّته الحقيقيّة
// (contain)، ونسخةٌ ضبابيّة منه تملأ الجانبين — كإنستغرام وتيك توك على الكمبيوتر. وعلى
// الجوّال، حيث الفيديو الطوليّ يملأ صندوقاً طوليّاً بلا تكبير، لا يتغيّر شيء.
const MAX_UPSCALE = 1.6;

export function heroFit(el, w, h) {
  const box = el?.closest?.('.bz-homehero-slide');
  if (!box || !w || !h) return;
  const cover = Math.max(box.clientWidth / w, box.clientHeight / h);
  box.dataset.fit = cover > MAX_UPSCALE ? 'contain' : 'cover';
}

// معالجات جاهزة لعناصر الفيديو والصورة
export const onVideoMeta = (e) => heroFit(e.currentTarget, e.currentTarget.videoWidth, e.currentTarget.videoHeight);
export const onImageLoad = (e) => heroFit(e.currentTarget, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
