import { cldThumb, cldVideoPoster } from './cloudinary.js';

// صورةُ رأسِ اللوحةِ ودرجِها — مصدرٌ واحدٌ يستعملُه الاثنان فلا يفترقان.
//
// الترتيب: ما اختارته التاجرةُ من إعداداتِها أوّلاً، فإن لم تختر شيئاً أخذنا
// أوّلَ بانرٍ من سلايدرِ متجرِها — فالرأسُ يحملُ وجهَ المتجرِ من أوّلِ يومٍ بلا
// أن يُطلَبَ منها فعلُ شيء. وإن لم يكن لها بانرٌ بقيَ التدرّجُ الداكن.
export function panelImage(store, width = 1280) {
  if (!store) return '';
  if (store.panelImage) return cldThumb(store.panelImage, width);
  const b = (store.banners || []).find((x) => x && x.bgValue && (x.bgType === 'image' || x.bgType === 'video'));
  if (!b) return '';
  return b.bgType === 'video' ? cldVideoPoster(b.bgValue, width) : cldThumb(b.bgValue, width);
}
