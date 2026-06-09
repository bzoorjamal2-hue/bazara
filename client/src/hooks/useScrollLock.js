import { useEffect } from 'react';

// يجمّد تمرير الصفحة خلف النوافذ/الأدراج المفتوحة بدون أي قفزة:
// يستعمل overflow:hidden على <html> و<body> (يحافظ على موضع التمرير كما هو،
// فلا تتأثّر العناصر اللاصقة/المربوطة بالتمرير ولا تحدث قفزة عند الفتح/الإغلاق).
export default function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [locked]);
}
