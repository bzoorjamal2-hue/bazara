import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { cldVideoPoster } from '../utils/cloudinary.js';

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

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add = (product, qty = 1) => {
    setItems((prev) => {
      // متجر مختلف عن السلة الحالية → نفرّغها أولاً (لا نخلط منتجات متجرين)
      const slug = product.storeSlug;
      const base = slug && prev.length && prev[0].storeSlug && prev[0].storeSlug !== slug ? [] : prev;
      const key = lineKey(product);
      const existing = base.find((i) => i.key === key);
      if (existing) {
        return base.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i));
      }
      return [
        ...base,
        {
          key,
          id: product.id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl || (product.images && product.images[0]) || (product.videoUrl ? cldVideoPoster(product.videoUrl) : '') || '',
          storeName: product.storeName,
          storeSlug: product.storeSlug,
          // رقم واتساب المتجر دائماً (حتى لو أُضيف المنتج من الصفحة الرئيسية العامة)
          whatsapp: product.whatsapp || product.storeWhatsapp || '',
          size: product.size || '',
          color: product.color || '',
          qty,
        },
      ];
    });
    setOpen(true);
  };

  const remove = (key) => setItems((prev) => prev.filter((i) => i.key !== key));
  const setQty = (key, qty) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty: Math.max(1, qty) } : i)));
  const clear = () => setItems([]);

  // تفرّغ السلة تلقائياً عند دخول متجر مختلف عن متجر عناصر السلة الحالية
  const ensureStore = (slug) => {
    if (!slug) return;
    setItems((prev) => (prev.length && prev[0].storeSlug && prev[0].storeSlug !== slug ? [] : prev));
  };

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);

  return (
    <CartContext.Provider value={{ items, add, remove, setQty, clear, ensureStore, count, total, open, setOpen }}>
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
