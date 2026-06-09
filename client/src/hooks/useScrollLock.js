import { useEffect } from 'react';

// يجمّد تمرير الصفحة خلف النوافذ/الأدراج المفتوحة (يعمل بثبات حتى على iOS Safari)
// عبر تثبيت الـ body مع الحفاظ على موضع التمرير واستعادته عند الإغلاق.
export default function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const scrollY = window.scrollY;
    const { body } = document;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
