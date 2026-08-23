import { useEffect, useRef, useState } from 'react';
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

export default function DashDrawerNav({ groups, activeKey, onNavigate, badges = {}, children }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [more, setMore] = useState(false);
  // اللحّ (النطّة) لمن لم يمرّر القائمة ولا مرّة على هذا الجهاز
  const [nudge, setNudge] = useState(() => {
    try { return !localStorage.getItem(SCROLLED_KEY); } catch { return true; }
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    const onScroll = () => {
      check();
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
      <nav ref={ref} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
        {groups.map((g) => (
          <div key={g.id}>
            <p
              className="menu-row px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-cream/40"
              style={{ animationDelay: `${row++ * 24}ms` }}
            >
              {g.title}
            </p>
            {g.items.map((s) => {
              const active = s.key === activeKey;
              const badge = badges[s.key];
              return (
                <Link
                  key={s.key}
                  to={`/dashboard?tab=${s.key}`}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  style={{ animationDelay: `${row++ * 24}ms` }}
                  className={`menu-row relative flex items-center gap-3 rounded-xl py-2 pe-3 ps-3.5 text-[15px] transition ${
                    active
                      ? 'bg-cream/12 font-bold text-cream ring-1 ring-gold-400/25'
                      : 'text-cream/85 hover:bg-cream/10 hover:text-cream'
                  }`}
                >
                  {/* شريط ذهبي على حافّة البداية يعلّم القسم المفتوح */}
                  {active && <span aria-hidden className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-gold-400" />}
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                      active ? 'bg-gold-400 text-wine-dark shadow-sm' : 'bg-cream/10 text-cream/75'
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
                        style={s.badgeTone === 'green' ? undefined : { background: 'linear-gradient(135deg, #f4e0a4 0%, #e6c878 55%, #d4af37 100%)' }}
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
      </nav>

      {/* حافّة متدرّجة + مؤشّر: «في أقسام تحت» — يختفيان عند الوصول لآخر القائمة */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-wine-dark via-wine-dark/85 to-transparent transition-opacity duration-300 ${more ? 'opacity-100' : 'opacity-0'}`}
      />
      <button
        type="button"
        onClick={scrollMore}
        tabIndex={more ? 0 : -1}
        className={`absolute inset-x-0 bottom-1 mx-auto flex w-max items-center gap-1 rounded-full bg-gold-400 px-3 py-1 text-[11px] font-extrabold text-wine-dark shadow-lg transition-opacity duration-300 ${
          more ? 'opacity-100' : 'pointer-events-none opacity-0'
        } ${more && nudge ? 'menu-nudge' : ''}`}
      >
        {t('dashboard.menu.more')} <ArrowDownIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
