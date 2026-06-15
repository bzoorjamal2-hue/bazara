import { useEffect } from 'react';

// قفل تمرير الخلفية بشكل موثوق على كل الأجهزة بما فيها iOS.
// على iOS لا يكفي overflow:hidden — لازم position:fixed على <body> لمنع
// تمرير الصفحة خلف النوافذ/الأدراج. نحفظ موضع التمرير ونعيده عند الإغلاق.
// عدّاد مرجعي ليعمل مع النوافذ المتداخلة (لا يُفتح القفل إلا بإغلاق آخر نافذة).

let lockCount = 0;
let savedScrollY = 0;

function applyLock() {
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  const body = document.body;
  body.style.position = 'fixed';
  body.style.top = `-${savedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

function releaseLock() {
  const body = document.body;
  const root = document.documentElement;
  // نفرض تمريراً فورياً أثناء الاستعادة كي لا "ينزل" المحتوى ببطء أمام المستخدم
  const prevBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  body.style.overflow = '';
  root.style.overflow = '';
  window.scrollTo(0, savedScrollY);
  root.style.scrollBehavior = prevBehavior;
}

export default function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    lockCount += 1;
    if (lockCount === 1) applyLock();
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) releaseLock();
    };
  }, [locked]);
}
