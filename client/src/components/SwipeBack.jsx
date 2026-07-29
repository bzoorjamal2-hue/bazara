import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isStandalone } from '../utils/pwa.js';

// إيماءة «السحب من الحافة للرجوع» — بإحساس التطبيقات الأصلية (إنستغرام/iOS).
// تُفعَّل فقط في التطبيق المثبّت (standalone): المتصفّحات لها إيماءتها الخاصة، أما
// التطبيق المثبّت فبلا شريط ولا زر رجوع، فكان المستخدم يعلق. اتجاهياً:
//   LTR: يبدأ السحب من الحافة اليسرى ويسحب يميناً.
//   RTL: يبدأ من الحافة اليمنى ويسحب يساراً.
// المحتوى (main) يتبع الإصبع لحظياً (transform على وحدة الرسم فقط)، وعند تجاوز
// العتبة نستدعي رجوع التاريخ — فتنزلق الصفحة السابقة إلى مكانها (يتكفّل باقي النظام
// باستعادة موضع التمرير فوراً). بلا commit تنزلق الحالية راجعةً لمكانها.
const EDGE = 24;      // منطقة بدء السحب من الحافة (px)
const THRESHOLD = 0.32; // نسبة العرض المطلوبة للرجوع

export default function SwipeBack() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const rtl = i18n.language !== 'en';

  useEffect(() => {
    if (!isStandalone()) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let main = null;
    let startX = 0, startY = 0, dx = 0;
    let active = false;   // بدأنا سحباً أفقياً فعلياً من الحافة
    let candidate = false; // لمسة بدأت من الحافة، ننتظر لنعرف اتجاهها

    const setX = (v) => { if (main) main.style.transform = v ? `translate3d(${v}px,0,0)` : ''; };

    const onStart = (e) => {
      // لا نتدخّل أثناء قفل التمرير (درج/نافذة مفتوحة تثبّت body)
      if (document.body.style.position === 'fixed') return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const w = window.innerWidth;
      const fromEdge = rtl ? t.clientX > w - EDGE : t.clientX < EDGE;
      if (!fromEdge) return;
      candidate = true; active = false; dx = 0;
      startX = t.clientX; startY = t.clientY;
      main = document.querySelector('main');
    };

    const onMove = (e) => {
      if (!candidate) return;
      const t = e.touches[0];
      const ddx = t.clientX - startX;
      const ddy = t.clientY - startY;
      if (!active) {
        // نحسم الاتجاه: أفقي غالب وباتجاه الرجوع الصحيح → نفعّل
        if (Math.abs(ddy) > Math.abs(ddx)) { candidate = false; return; } // تمرير عمودي
        const backward = rtl ? ddx < -6 : ddx > 6;
        if (backward) { active = true; if (main) main.style.transition = 'none'; }
        else if (Math.abs(ddx) > 6) { candidate = false; return; }
        else return;
      }
      // إزاحة باتجاه الرجوع فقط (بمقاومة عند العكس)
      dx = rtl ? Math.min(0, ddx) : Math.max(0, ddx);
      e.preventDefault();
      setX(dx);
    };

    const finish = () => {
      candidate = false;
      if (!active) return;
      active = false;
      const w = window.innerWidth;
      const passed = Math.abs(dx) > w * THRESHOLD;
      const el = main;
      if (el) el.style.transition = 'transform .26s cubic-bezier(0.22, 0.61, 0.36, 1)';
      if (passed) {
        navigate(-1); // الصفحة السابقة تُركّب الآن والـmain لا يزال منزاحاً → تنزلق لمكانها
        requestAnimationFrame(() => { if (el) el.style.transform = ''; });
      } else {
        setX(0); // إلغاء — تعود الحالية لمكانها
      }
      // تنظيف الأنماط بعد انتهاء الحركة
      setTimeout(() => { if (el) { el.style.transition = ''; el.style.transform = ''; } }, 300);
      dx = 0; main = null;
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', finish, { passive: true });
    document.addEventListener('touchcancel', finish, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', finish);
      document.removeEventListener('touchcancel', finish);
    };
  }, [navigate, rtl]);

  return null;
}
