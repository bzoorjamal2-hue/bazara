// "شاهدت مؤخراً" — تتبّع آخر المنتجات التي زارها المستخدم (محلياً، بلا خادم).
const KEY = 'recently_viewed_v1';
const MAX = 12;

export function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function pushRecent(product) {
  if (!product || !product.id) return;
  try {
    const item = {
      id: product.id,
      name: product.name,
      price: product.price,
      oldPrice: product.oldPrice || null,
      imageUrl: product.imageUrl || (product.images && product.images[0]) || '',
      storeSlug: product.storeSlug || '',
    };
    const list = getRecent().filter((p) => p.id !== product.id);
    list.unshift(item);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* تجاهل */
  }
}
