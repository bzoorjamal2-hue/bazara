// تأثير "طيران المنتج إلى السلة" عند الإضافة — إحساس احترافي زي التطبيقات الكبيرة.
// ينسخ صورة المنتج ويطيّرها بقوس ناعم نحو أيقونة السلة، ثم ينبضها.

// نختار أيقونة السلة المرئية حالياً (الشريط السفلي داخل التطبيق أو الهيدر في المتصفّح)
function pickCartTarget() {
  const targets = [...document.querySelectorAll('[data-cart-target]')];
  // المرئي فعلاً (له أبعاد وغير مخفي)
  const visible = targets.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.offsetParent !== null;
  });
  return visible[visible.length - 1] || targets[0] || null;
}

export function flyToCart(sourceEl, imgUrl) {
  try {
    if (!sourceEl || !imgUrl) return;
    const target = pickCartTarget();
    if (!target) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const from = sourceEl.getBoundingClientRect();
    const to = target.getBoundingClientRect();

    const startSize = Math.min(from.width, 120);
    const fly = document.createElement('img');
    fly.src = imgUrl;
    Object.assign(fly.style, {
      position: 'fixed',
      left: `${from.left + from.width / 2 - startSize / 2}px`,
      top: `${from.top + from.height / 2 - startSize / 2}px`,
      width: `${startSize}px`,
      height: `${startSize}px`,
      objectFit: 'cover',
      borderRadius: '16px',
      boxShadow: '0 12px 30px rgba(94,70,54,0.4)',
      zIndex: '2000',
      pointerEvents: 'none',
      willChange: 'transform, opacity',
    });
    document.body.appendChild(fly);

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    const anim = fly.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        // نقطة منتصف مرتفعة لإعطاء إحساس القوس
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 70}px) scale(0.6)`, opacity: 0.95, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.2 },
      ],
      { duration: 750, easing: 'cubic-bezier(0.5, 0, 0.5, 1)', fill: 'forwards' }
    );

    anim.onfinish = () => {
      fly.remove();
      // نبضة على أيقونة السلة
      target.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.35)' },
          { transform: 'scale(1)' },
        ],
        { duration: 360, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
      );
    };
  } catch {
    /* تأثير تجميلي فقط — نتجاهل أي خطأ */
  }
}
