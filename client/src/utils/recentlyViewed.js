// "شاهدت مؤخراً" — تتبّع آخر المنتجات التي زارها المستخدم (محلياً، بلا خادم).
import { cldVideoPoster } from './cloudinary.js';

const KEY = 'recently_viewed_v1';
const MAX = 12;

// صورة المنتج: صورة، أو أول صورة معرض، أو لقطة من الفيديو (للمنتجات الفيديو)
export function productThumb(p) {
  return p.imageUrl || (p.images && p.images[0]) || (p.videoUrl ? cldVideoPoster(p.videoUrl) : '') || '';
}

export function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

// إزالة منتج من "شاهدت مؤخراً" — يُستدعى عند اكتشاف أنه حُذف (404) كي لا يظل بالريل
export function removeRecent(id) {
  try {
    const list = (JSON.parse(localStorage.getItem(KEY)) || []).filter((p) => p && p.id !== id);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* تجاهل */ }
}

export function pushRecent(product) {
  if (!product || !product.id) return;
  try {
    const item = {
      id: product.id,
      name: product.name,
      price: product.price,
      oldPrice: product.oldPrice || null,
      imageUrl: productThumb(product),
      videoUrl: product.videoUrl || '', // ليظهر مؤشّر التشغيل في شريط "شاهدت مؤخراً"
      storeSlug: product.storeSlug || '',
      category: product.category || '', // لريل "مقترحات لكِ" — نتعلّم ذوقها من فئات ما تشاهده
    };
    const list = getRecent().filter((p) => p.id !== product.id);
    list.unshift(item);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* تجاهل */
  }
}
