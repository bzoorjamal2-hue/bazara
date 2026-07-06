import { createContext, useContext, useEffect, useState } from 'react';
import { productThumb } from '../utils/recentlyViewed.js';
import { trackPixel } from '../utils/pixels.js';

const WishlistContext = createContext(null);
const KEY = 'wishlist_v1';

export function WishlistProvider({ children }) {
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

  const has = (id) => items.some((i) => i.id === id);

  const toggle = (product) => {
    // حدث بكسل التمويل عند الإضافة فقط (لا عند الإزالة) — إشارة اهتمام قوية للإعلانات
    if (!items.some((i) => i.id === product.id)) {
      trackPixel('AddToWishlist', { value: Number(product.price) || 0, content_name: product.name, content_ids: [product.id], content_type: 'product' });
    }
    setItems((prev) => {
      if (prev.some((i) => i.id === product.id)) return prev.filter((i) => i.id !== product.id);
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          oldPrice: product.oldPrice,
          imageUrl: productThumb(product),
          category: product.category,
          storeSlug: product.storeSlug,
          storeName: product.storeName,
        },
      ];
    });
  };

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <WishlistContext.Provider value={{ items, has, toggle, remove, count: items.length, open, setOpen }}>
      {children}
    </WishlistContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
