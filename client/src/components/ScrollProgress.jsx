import { useEffect, useRef } from 'react';

// شريط تقدّم ذهبي رفيع أعلى الصفحة يمتلئ مع التمرير — لمسة فخامة حديثة.
// أداء عالٍ: نحدّث scaleX على العنصر مباشرةً عبر المرجع (خاصية مركّبة على الـGPU)،
// بلا setState ولا إعادة تصيير، ومستمع تمرير خامل (passive). لا تكلفة تُذكر.
export default function ScrollProgress() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let ticking = false;
    const update = () => {
      ticking = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        ref={ref}
        className="h-full origin-[left] bg-gradient-to-r from-[#8a6a4f] via-[#cdbda4] to-[#9c866a]"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}
