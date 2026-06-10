import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { cldVideoPoster } from '../utils/cloudinary.js';

const CartContext = createContext(null);
const KEY = 'cart_v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
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
      const existing = base.find((i) => i.id === product.id);
      if (existing) {
        return base.map((i) => (i.id === product.id ? { ...i, qty: i.qty + qty } : i));
      }
      return [
        ...base,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl || (product.images && product.images[0]) || (product.videoUrl ? cldVideoPoster(product.videoUrl) : '') || '',
          storeName: product.storeName,
          storeSlug: product.storeSlug,
          whatsapp: product.whatsapp || '',
          qty,
        },
      ];
    });
    setOpen(true);
  };

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const setQty = (id, qty) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
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
