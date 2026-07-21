import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { cldVideoPoster } from '../utils/cloudinary.js';
import { trackPixel } from '../utils/pixels.js';

const CartContext = createContext(null);
const KEY = 'cart_v1';

// مفتاح فريد لسطر السلة: نفس المنتج بمقاس/لون مختلف = سطر منفصل
const lineKey = (p) => `${p.id}__${p.size || ''}__${p.color || ''}`;

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY)) || [];
      // ترقية السلات القديمة: نضمن وجود مفتاح سطر لكل عنصر
      return saved.map((i) => ({ size: '', color: '', ...i, key: i.key || lineKey(i) }));
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);
  const [checkoutIntent, setCheckoutIntent] = useState(false); // فتح السلة مباشرة على شاشة إتمام الطلب (شراء فوري)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  // المتبقي بالمخزون لهذه التشكيلة (لون/نمرة) — يُحفظ مع القطعة ليقيّد عدّاد السلة
  const stockOf = (p) => {
    const cs = p.colorStock && typeof p.colorStock === 'object' ? p.colorStock : null;
    if (cs && p.color && cs[p.color] && typeof cs[p.color][p.size] === 'number') return cs[p.color][p.size];
    const ss = p.sizeStock && typeof p.sizeStock === 'object' ? p.sizeStock : null;
    if (ss && p.size && typeof ss[p.size] === 'number') return ss[p.size];
    return typeof p.stock === 'number' ? p.stock : null;
  };

  const add = (product, qty = 1) => {
    setItems((prev) => {
      // متجر مختلف عن السلة الحالية → نفرّغها أولاً (لا نخلط منتجات متجرين)
      const slug = product.storeSlug;
      const base = slug && prev.length && prev[0].storeSlug && prev[0].storeSlug !== slug ? [] : prev;
      const key = lineKey(product);
      const existing = base.find((i) => i.key === key);
      const maxQty = stockOf(product);
      if (existing) {
        // الإضافة المتكرّرة لنفس التشكيلة لا تتجاوز المتبقي بالمخزون
        return base.map((i) => (i.key === key ? { ...i, maxQty, qty: maxQty != null ? Math.min(i.qty + qty, Math.max(1, maxQty)) : i.qty + qty } : i));
      }
      return [
        ...base,
        {
          key,
          id: product.id,
          name: product.name,
          price: product.price,
          oldPrice: product.oldPrice, // لعرض إجمالي التوفير بالسلة عند وجود خصم
          imageUrl: product.imageUrl || (product.images && product.images[0]) || (product.videoUrl ? cldVideoPoster(product.videoUrl) : '') || '',
          storeName: product.storeName,
          storeSlug: product.storeSlug,
          // رقم واتساب المتجر دائماً (حتى لو أُضيف المنتج من الصفحة الرئيسية العامة)
          whatsapp: product.whatsapp || product.storeWhatsapp || '',
          size: product.size || '',
          color: product.color || '',
          maxQty,
          qty,
        },
      ];
    });
    setOpen(true);
    // حدث بكسل التمويل (لا يعمل إلا إذا كان بكسل المتجر محقوناً بالصفحة)
    trackPixel('AddToCart', { value: (Number(product.price) || 0) * qty, content_name: product.name, content_ids: [product.id], content_type: 'product' });
  };

  // شراء فوري: يضيف المنتج ويطلب فتح شاشة إتمام الطلب مباشرةً
  const buyNow = (product, qty = 1) => {
    add(product, qty);
    setCheckoutIntent(true);
  };

  const remove = (key) => setItems((prev) => prev.filter((i) => i.key !== key));
  const setQty = (key, qty) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty: Math.max(1, i.maxQty != null ? Math.min(qty, i.maxQty) : qty) } : i)));
  const clear = () => setItems([]);

  // تفرّغ السلة تلقائياً عند دخول متجر مختلف عن متجر عناصر السلة الحالية
  const ensureStore = (slug) => {
    if (!slug) return;
    setItems((prev) => (prev.length && prev[0].storeSlug && prev[0].storeSlug !== slug ? [] : prev));
  };

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);

  return (
    <CartContext.Provider value={{ items, add, buyNow, remove, setQty, clear, ensureStore, count, total, open, setOpen, checkoutIntent, setCheckoutIntent }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
