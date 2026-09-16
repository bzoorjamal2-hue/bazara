// جلبُ شيفرةِ الصفحةِ قبلَ أن تُرفَعَ الإصبع.
//
// كلُّ صفحةٍ بالموقعِ تُحمَّلُ كسولاً ‎(lazy)، فالضغطُ على تبويبٍ يبدأُ بتنزيلِ
// حزمتِه ثمّ يُركّبُها. قِستُ الانتقالَ من الرئيسيّةِ إلى التصنيفاتِ على جهازٍ
// سريعٍ وشبكةٍ محليّة: ١٤٤ms حتى يظهرَ المحتوى، منها ٩١ms مهمّةٌ طويلةٌ تُجمّدُ
// الخيطَ الرئيسيّ. على جوّالٍ بشبكةِ بياناتٍ يصيرُ التنزيلُ وحدَه نصفَ ثانيةٍ
// أو أكثر — وهو «التعليق» الذي يُحَسّ.
//
// و‎pointerdown يسبقُ ‎click بنحوِ مئةِ مليّ ثانيةٍ على اللمس (زمنُ وضعِ الإصبعِ
// ورفعِه)، فنبدأُ التنزيلَ بها: حين تصلُ الضغطةُ تكونُ الحزمةُ جاهزةً أو قاربت.
// ولا كلفةَ زائدة — نُنزّلُ ما كانت ستطلبُه الضغطةُ نفسُها بعد لحظة.
//
// والمواصفاتُ هنا مطابقةٌ لما بـApp.jsx حرفاً: المتصفّحُ يفهرسُ الوحداتِ بعنوانِها
// بعدَ الحلّ، فالنداءُ الثاني لا يُنزّلُ شيئاً — يُرجِعُ الوعدَ المحلولَ نفسَه.
const ROUTES = {
  home: () => import('../pages/Home.jsx'),
  categories: () => import('../pages/Categories.jsx'),
  reels: () => import('../pages/Reels.jsx'),
  offers: () => import('../pages/Offers.jsx'),
  store: () => import('../pages/StorePage.jsx'),
  dashboard: () => import('../pages/Dashboard.jsx'),
  login: () => import('../pages/Login.jsx'),
  product: () => import('../pages/ProductDetails.jsx'),
  search: () => import('../pages/Search.jsx'),
  track: () => import('../pages/Track.jsx'),
};

const done = new Set(); // لا نُعيدُ النداءَ لما جُلب: رخيصٌ لكن ليس مجّانيّاً

export function prefetchRoute(key) {
  const load = ROUTES[key];
  if (!load || done.has(key)) return;
  done.add(key);
  load().catch(() => done.delete(key)); // فشلُ الشبكة: نسمحُ بمحاولةٍ لاحقة
}

// المسارُ → مفتاحُ الحزمة. يُستعمَلُ حين نملكُ الرابطَ لا المفتاح.
export function routeKeyOf(to) {
  const path = String(to || '').split('?')[0];
  if (path === '/shop' || path === '/') return 'home';
  if (path === '/categories' || path.startsWith('/category/')) return 'categories';
  if (path.endsWith('/reels')) return 'reels';
  if (path === '/offers') return 'offers';
  if (path.startsWith('/product/')) return 'product';
  if (path.startsWith('/store/')) return 'store';
  if (path.startsWith('/dashboard')) return 'dashboard';
  if (path === '/login') return 'login';
  if (path === '/search' || path.endsWith('/search')) return 'search';
  if (path === '/track' || path.endsWith('/track')) return 'track';
  return '';
}
