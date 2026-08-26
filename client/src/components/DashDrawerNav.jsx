import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDownIcon } from './icons.jsx';

// قائمة أقسام اللوحة داخل الدرج الجانبي.
//
// كانت لائحةً مسطّحة من اثني عشر رابطاً متشابهاً، ونصفها تحت حافّة الشاشة —
// صاحب المتجر الجديد ما بيعرف إنه في أقسام تحت أصلاً. صار فيها:
//   • مجموعات معنونة (متجري · النموّ · الإدارة) بدل جدارٍ من الروابط
//   • مؤشّر «في المزيد تحت» + تدرّج يخبّي الحافّة — يختفي أول ما توصل للآخر،
//     وبيلحّ (نطّة خفيفة) لصاحب المتجر اللي لسّا ما مرّر ولا مرّة
//   • دخول متتابع للصفوف (٢٤ملّي بين الواحد والتالي) فتبان القائمة مرتّبة
// كل حساب بياخدها: صاحب متجر ومدير — نفس المكوّن بمجموعاتٍ مختلفة.

const SCROLLED_KEY = 'bz_menu_scrolled';
const POS_KEY = 'bz_menu_scroll_top'; // موضع القائمة — يبقى كما تركه صاحب المتجر

export default function DashDrawerNav({ groups, activeKey, onNavigate, badges = {}, children, brand }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [more, setMore] = useState(false);
  // اللحّ (النطّة) لمن لم يمرّر القائمة ولا مرّة على هذا الجهاز
  const [nudge, setNudge] = useState(() => {
    try { return !localStorage.getItem(SCROLLED_KEY); } catch { return true; }
  });

  // استعادة موضع القائمة قبل الرسم: يفتح الدرج فيلاقيه كما تركه، لا مقذوفاً للأعلى.
  // وإن لم يكن له موضع محفوظ نُظهر القسم المفتوح (قد يكون تحت الحافّة).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let top = 0;
    try { top = Number(sessionStorage.getItem(POS_KEY)) || 0; } catch { top = 0; }
    if (top > 0) {
      el.scrollTop = Math.min(top, el.scrollHeight - el.clientHeight);
    } else {
      const current = el.querySelector('[aria-current="page"]');
      if (current && current.offsetTop + current.offsetHeight > el.clientHeight) {
        el.scrollTop = current.offsetTop - el.clientHeight / 2 + current.offsetHeight;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    const onScroll = () => {
      check();
      try { sessionStorage.setItem(POS_KEY, String(Math.round(el.scrollTop))); } catch { /* تصفّح خاص */ }
      if (el.scrollTop > 24) {
        setNudge(false);
        try { localStorage.setItem(SCROLLED_KEY, '1'); } catch { /* تصفّح خاص */ }
      }
    };
    check();
    el.addEventListener('scroll', onScroll, { passive: true });
    // القائمة تُبنى بعد وصول الشارات/النصوص، فنقيس مع كل تغيّر حجم
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect(); };
  }, [groups]);

  const scrollMore = () => {
    const el = ref.current;
    if (el) el.scrollBy({ top: el.clientHeight * 0.75, behavior: 'smooth' });
  };

  let row = 0; // ترقيم متسلسل عبر المجموعات لتتابع الدخول

  return (
    <div className="relative mt-3 flex min-h-0 flex-1 flex-col">
      <nav ref={ref} className="dash-menu-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col gap-0.5 pb-4">
        {children}
        {groups.map((g) => (
          <div key={g.id} className="flex flex-col gap-0.5">
            <div
              className="menu-row flex items-center gap-2 px-3 pb-1.5 pt-4"
              style={{ animationDelay: `${row++ * 24}ms` }}
            >
              <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gold-200">{g.title}</span>
              <span aria-hidden className="h-px flex-1 bg-gold-400/20" />
            </div>
            {g.items.map((s) => {
              const active = s.key === activeKey;
              const badge = badges[s.key];
              return (
                <Link
                  key={s.key}
                  to={`/dashboard?tab=${s.key}`}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  draggable={false}
                  style={{ animationDelay: `${row++ * 24}ms` }}
                  className={`menu-row app-tap relative flex items-center gap-3 rounded-2xl py-2 pe-3 ps-3.5 text-[15px] transition duration-200 active:scale-[0.985] ${
                    active
                      ? 'bg-cream/[0.14] font-extrabold text-cream ring-1 ring-gold-400/35'
                      : 'font-semibold text-cream hover:bg-cream/10'
                  }`}
                >
                  {/* شريط ذهبي على حافّة البداية يعلّم القسم المفتوح */}
                  {active && <span aria-hidden className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-gold-400" />}
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 transition ${
                      active
                        ? 'bg-[#e4d8c5] text-[#2b1d12] ring-[#e4d8c5]/50'
                        : 'bg-cream/[0.12] text-cream ring-cream/10'
                    }`}
                  >
                    <s.Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  {badge > 0 && (
                    <span className="relative flex h-6 min-w-6 items-center justify-center">
                      <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.badgeTone === 'green' ? 'bg-emerald-400/50' : 'bg-gold-400/50'}`}
                        style={{ animationDuration: '1.8s' }}
                      />
                      <span
                        className={`relative flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-extrabold shadow-sm ring-1 ring-cream/50 ${
                          s.badgeTone === 'green' ? 'bg-emerald-500 text-white' : 'text-wine-dark'
                        }`}
                        style={s.badgeTone === 'green' ? undefined : { background: 'linear-gradient(135deg, #eae0cf 0%, #cdbda4 55%, #b09a7e 100%)' }}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
        {brand && <div className="mt-auto pt-6">{brand}</div>}
        </div>
      </nav>

      {/* حافّة متدرّجة + مؤشّر: «في أقسام تحت» — يختفيان عند الوصول لآخر القائمة */}
      <div
        aria-hidden
        className={`dash-drawer-fade pointer-events-none absolute inset-x-0 bottom-0 h-14 transition-opacity duration-300 ${more ? 'opacity-100' : 'opacity-0'}`}
      />
      <button
        type="button"
        onClick={scrollMore}
        tabIndex={more ? 0 : -1}
        className={`app-tap absolute inset-x-0 bottom-1 mx-auto flex w-max items-center gap-1 rounded-full bg-[#e4d8c5] px-3 py-1 text-[11px] font-extrabold text-[#2b1d12] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.5)] transition-opacity duration-300 ${
          more ? 'opacity-100' : 'pointer-events-none opacity-0'
        } ${more && nudge ? 'menu-nudge' : ''}`}
      >
        {t('dashboard.menu.more')} <ArrowDownIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
