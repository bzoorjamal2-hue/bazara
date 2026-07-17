// نقاط الألوان على بطاقات المنتجات (أسلوب المتاجر الكبرى):
// قاموس موسّع يغطي ألوان الموضة العصرية بالعربية والإنجليزية (كابتشينو، موكا،
// تيفاني، نيود، هافان…) + فهم تلقائي لـ"فاتح/غامق/محروق/باستيل".
// الاسم غير المعروف يُتجاهل بهدوء.
const MAP = {
  // ─── محايدات وأبيض/أسود/رمادي ───
  'اسود': '#1c1c1c', black: '#1c1c1c',
  'ابيض': '#f8f8f8', white: '#f8f8f8',
  'اوف وايت': '#f3ecdc', offwhite: '#f3ecdc', 'off white': '#f3ecdc', 'عاجي': '#f3ecdc', ivory: '#f3ecdc',
  'كريمي': '#f1e6d2', cream: '#f1e6d2', 'فانيلا': '#f3e5c0', vanilla: '#f3e5c0',
  'سكري': '#f2e8d5', 'لولوي': '#ece8e1', pearl: '#ece8e1',
  'شمبانيا': '#e8d8b8', 'شامبين': '#e8d8b8', champagne: '#e8d8b8',
  'رمادي': '#8a8a8a', gray: '#8a8a8a', grey: '#8a8a8a', 'رصاصي': '#7f8790',
  'فضي': '#c8c8c8', 'سلفر': '#c8c8c8', silver: '#c8c8c8', 'بلاتيني': '#d5d5d5', platinum: '#d5d5d5',
  'فحمي': '#3d3d3d', 'شاركول': '#3d3d3d', charcoal: '#3d3d3d', 'جرافيت': '#4a4a4a', graphite: '#4a4a4a',
  'دخني': '#6e6e6e', smoke: '#6e6e6e', smokey: '#6e6e6e',

  // ─── عائلة البني والقهوة (الأكثر طلباً بالموضة) ───
  'بني': '#6b4a2f', brown: '#6b4a2f',
  'كابتشينو': '#b28a68', cappuccino: '#b28a68',
  'موكا': '#6f4e37', 'موكه': '#6f4e37', mocha: '#6f4e37', 'قهوه': '#5c4033', coffee: '#5c4033',
  'نسكافيه': '#a67b5b', 'لاتيه': '#c8a887', latte: '#c8a887',
  'كراميل': '#c68e5e', caramel: '#c68e5e',
  'شوكولاته': '#4e342e', chocolate: '#4e342e', 'كاكاو': '#5d4037', cocoa: '#5d4037',
  'عسلي': '#c99e5f', honey: '#c99e5f',
  'جملي': '#b08a5a', 'كاميل': '#b08a5a', camel: '#b08a5a', 'هافان': '#9a6a3f', havan: '#9a6a3f',
  'تان': '#c19a6b', tan: '#c19a6b', 'بسكوتي': '#d9b98c', 'بسكويتي': '#d9b98c', biscuit: '#d9b98c',
  'جوزي': '#7a5230', walnut: '#7a5230', 'كستنائي': '#6d3f2a', chestnut: '#6d3f2a',
  'ترابي': '#9c7e65', 'بيج': '#d9c4a3', beige: '#d9c4a3',
  'نيود': '#e3c4a8', 'نود': '#e3c4a8', nude: '#e3c4a8', 'توبي': '#a68a79', 'طوبي': '#a68a79', taupe: '#a68a79',
  'غريج': '#b5aa9d', greige: '#b5aa9d', 'رملي': '#d6c6a8', sand: '#d6c6a8',
  'حجري': '#b8b0a1', stone: '#b8b0a1', 'شوفان': '#e0d5c0', oat: '#e0d5c0', oatmeal: '#e0d5c0',
  'كشمير': '#d7c3b5', cashmere: '#d7c3b5',

  // ─── الأحمر وعائلته ───
  'احمر': '#c0392b', red: '#c0392b', 'قرمزي': '#9e1b32', crimson: '#9e1b32',
  'كرزي': '#9b1b30', cherry: '#9b1b30',
  'خمري': '#722f37', 'نبيذي': '#722f37', wine: '#722f37',
  'برغندي': '#722f37', 'بورجندي': '#722f37', burgundy: '#722f37',
  'عنابي': '#7f1d2f', 'ماروني': '#7f1d2f', maroon: '#7f1d2f',
  'قرميدي': '#a34a35', brick: '#a34a35', 'تراكوتا': '#c66b4e', terracotta: '#c66b4e',
  'صدئي': '#a85238', 'صدأي': '#a85238', rust: '#a85238',

  // ─── الوردي وعائلته ───
  'وردي': '#e8a2b8', 'زهري': '#e8a2b8', pink: '#e8a2b8', 'روز': '#d98ca4', rose: '#d98ca4',
  'بيبي بينك': '#f4c2cf', 'بودري': '#ecd4cc', powder: '#ecd4cc',
  'نهدي': '#c8a2a8', 'بلاش': '#e7bfb3', blush: '#e7bfb3',
  'فوشي': '#d63384', fuchsia: '#d63384', 'ماجنتا': '#c2185b', magenta: '#c2185b',
  'مرجاني': '#e8836f', 'كورال': '#e8836f', coral: '#e8836f',
  'سلموني': '#f4a08c', 'سالمون': '#f4a08c', salmon: '#f4a08c',
  'خوخي': '#f5b895', peach: '#f5b895', 'مشمشي': '#f0a875', apricot: '#f0a875',
  'توتي': '#8e4162', berry: '#8e4162',

  // ─── البنفسجي وعائلته ───
  'بنفسجي': '#6d5aa8', purple: '#6d5aa8', violet: '#6d5aa8',
  'موف': '#b39ddb', mauve: '#b39ddb', 'ليلكي': '#c5b3e6', lilac: '#c5b3e6',
  'لافندر': '#c3b1e1', lavender: '#c3b1e1',
  'باذنجاني': '#4a2a4d', eggplant: '#4a2a4d', 'برقوقي': '#7e4a66', plum: '#7e4a66',
  'ارجواني': '#8e3a80', 'عودي': '#5d3a54',

  // ─── الأزرق وعائلته ───
  'كحلي': '#1f2a44', navy: '#1f2a44', 'نيفي': '#1f2a44',
  'ازرق': '#2563eb', blue: '#2563eb', 'ازرق ملكي': '#2f4fbf', 'رويال': '#2f4fbf', royal: '#2f4fbf',
  'سماوي': '#7dd3fc', sky: '#7dd3fc', 'بيبي بلو': '#a8cbe8', 'لبني': '#b8d8ea',
  'نيلي': '#3f51a3', indigo: '#3f51a3', 'دينم': '#4a6d9c', denim: '#4a6d9c', 'جينز': '#4a6d9c',
  'بترولي': '#2a6f77', petrol: '#2a6f77', 'تيل': '#26777d', teal: '#26777d',
  'تركواز': '#2aa8a0', 'تركوازي': '#2aa8a0', turquoise: '#2aa8a0',
  'فيروزي': '#30b8b2', 'تيفاني': '#81d8d0', tiffany: '#81d8d0',
  'اكوا': '#6cd1cb', aqua: '#6cd1cb', 'سيان': '#22b8cf', cyan: '#22b8cf',

  // ─── الأخضر وعائلته ───
  'اخضر': '#2f6b3a', green: '#2f6b3a',
  'زيتي': '#5b6236', 'زيتوني': '#5b6236', olive: '#5b6236',
  'عسكري': '#4b5320', 'جيشي': '#4b5320', army: '#4b5320',
  'كاكي': '#867954', 'خاكي': '#867954', khaki: '#867954',
  'نعناعي': '#a8d8c0', 'منت': '#a8d8c0', mint: '#a8d8c0',
  'ميرمي': '#9caf88', 'سيج': '#9caf88', sage: '#9caf88',
  'فستقي': '#b5cba1', pistachio: '#b5cba1',
  'زمردي': '#2e8b6a', emerald: '#2e8b6a', 'تفاحي': '#7cb342', 'ليم': '#9ccc3d', lime: '#9ccc3d',

  // ─── الأصفر والبرتقالي والمعادن ───
  'اصفر': '#e6c14c', yellow: '#e6c14c', 'ليموني': '#ece75f', lemon: '#ece75f',
  'خردلي': '#c9a227', mustard: '#c9a227', 'عنبري': '#d99a3d', amber: '#d99a3d',
  'زعفراني': '#e0973a', saffron: '#e0973a',
  'برتقالي': '#e67e22', orange: '#e67e22',
  'نحاسي': '#b87333', copper: '#b87333', 'برونزي': '#8c6b3f', bronze: '#8c6b3f',
  'ذهبي': '#d4af37', gold: '#d4af37', 'قولد': '#d4af37',
  'روز جولد': '#d8a49b', 'روز قولد': '#d8a49b', rosegold: '#d8a49b', 'rose gold': '#d8a49b',

  // ─── إنجليزي مكتوب بحروف عربية (شائع جداً بوصف الموضة) ───
  'بلاك': '#1c1c1c', 'وايت': '#f8f8f8', 'بلو': '#2563eb', 'ريد': '#c0392b',
  'جرين': '#2f6b3a', 'غرين': '#2f6b3a', 'اورنج': '#e67e22', 'اورانج': '#e67e22',
  'بينك': '#e8a2b8', 'يلو': '#e6c14c', 'بيربل': '#6d5aa8', 'بربل': '#6d5aa8',
  'براون': '#6b4a2f', 'جراي': '#8a8a8a', 'غراي': '#8a8a8a', 'قراي': '#8a8a8a',
  'سكاي': '#7dd3fc', 'اوليف': '#5b6236', 'مينت': '#a8d8c0', 'كوفي': '#5c4033',
  'فيوليت': '#6d5aa8', 'انديجو': '#3f51a3', 'شوكولا': '#4e342e', 'جولد': '#d4af37',
};

// توحيد الهمزات والتاء المربوطة + حروف صغيرة ليطابق "أسود"/"اسود" و"موكة"/"موكا" وغيرها
const norm = (s) => String(s || '').trim().toLowerCase()
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '')
  .replace(/[ً-ٟ]/g, ''); // تشكيل

// للمطابقة بالاحتواء: الأطول أولاً حتى لا يسبق "روز" اسم "روز جولد"
const KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length);

// ─── تعرّف ذكي يتحمّل الأخطاء الإملائية (أسلوب المصحّح التلقائي) ───
// 1) هيكل الكلمة: حذف ألفات المدّ يطابق "كبتشينو"="كابتشينو" و"نسكافه"="نسكافيه"
const skel = (s) => s.replace(/ا/g, '');
const SKEL = {};
for (const k of KEYS) { const sk = skel(k); if (sk.length >= 3 && !SKEL[sk]) SKEL[sk] = MAP[k]; }

// 2) مسافة دامراو-ليفنشتاين (حرف ناقص/زائد/مبدّل/مقلوب = خطأ واحد)
function editDist(a, b, cap) {
  const al = a.length; const bl = b.length;
  if (Math.abs(al - bl) > cap) return cap + 1;
  const d = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i += 1) d[i][0] = i;
  for (let j = 0; j <= bl; j += 1) d[0][j] = j;
  for (let i = 1; i <= al; i += 1) {
    for (let j = 1; j <= bl; j += 1) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[al][bl];
}

// عتبة التسامح حسب طول الكلمة — قصيرة جداً؟ خطأ واحد فقط (حتى لا يختلط أحمر/أخضر)
const fuzzyFind = (w) => {
  if (w.length < 3) return null;
  const cap = w.length <= 4 ? 1 : w.length <= 7 ? 2 : 3;
  let best = null; let bestD = cap + 1;
  for (const k of KEYS) {
    const d = editDist(w, k, cap);
    if (d < bestD) { bestD = d; best = k; if (d === 0) break; }
  }
  return best ? MAP[best] : null;
};

// كلمات وصفية لا تُفحص كأسماء ألوان
const MODIFIERS = /^(فاتح|فاتحه|غامق|غامقه|داكن|داكنه|محروق|باستيل|لون|درجه|light|dark|deep|burnt|pastel|color|shade)$/;

const lookup = (w) => MAP[w] || SKEL[skel(w)] || null;

// 3) محرّك المتصفح نفسه: يفهم كل أسماء CSS الإنجليزية الرسمية (148 اسماً مثل
// periwinkle وthistle) وأكواد hex — تغطية كاملة لما لا يعرفه قاموسنا
let cssProbe = null;
function cssParse(w) {
  if (/^#?[0-9a-f]{6}$/.test(w)) return w[0] === '#' ? w : `#${w}`; // كود hex مباشر
  if (typeof document === 'undefined' || /[؀-ۿ]/.test(w)) return null;
  if (!cssProbe) cssProbe = document.createElement('span');
  const s = cssProbe.style;
  s.color = '';
  s.color = w;
  if (!s.color) s.color = w.replace(/\s+/g, ''); // "light blue" → lightblue
  return s.color || null;
}

// "فاتح" يمزج نحو الأبيض و"غامق/محروق" نحو الأسود
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (x) => Math.max(0, Math.min(255, Math.round(f > 0 ? x + (255 - x) * f : x * (1 + f))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => ch(x).toString(16).padStart(2, '0')).join('')}`;
};

const CACHE = new Map(); // تُستدعى لكل بطاقة منتج — نحفظ النتيجة

export function colorToCss(name) {
  const n = norm(name);
  if (!n) return null;
  if (CACHE.has(n)) return CACHE.get(n);
  const words = n.split(/\s+/).filter((w) => !MODIFIERS.test(w));
  // ترتيب المحاولات: مطابقة مباشرة/هيكلية → كلمة-كلمة من الآخر (الوصف يلي الاسم:
  // "أخضر زيتي" → زيتي) → احتواء → تصحيح إملائي كاملاً ثم كلمة-كلمة
  let base = lookup(n);
  for (let i = words.length - 1; i >= 0 && !base; i -= 1) base = lookup(words[i]);
  if (!base) { const k = KEYS.find((key) => key.length >= 3 && n.includes(key)); if (k) base = MAP[k]; }
  if (!base) base = cssParse(n);
  if (!base) base = fuzzyFind(n);
  for (let i = words.length - 1; i >= 0 && !base; i -= 1) base = fuzzyFind(words[i]);
  for (let i = words.length - 1; i >= 0 && !base; i -= 1) base = cssParse(words[i]);
  let out = base || null;
  // درجات فاتح/غامق تُطبَّق على ألوان hex فقط (أسماء CSS تُعرض كما هي)
  if (out && out[0] === '#' && !MAP[n]) {
    if (/فاتح|باستيل|light|pastel|baby/.test(n)) out = shade(out, 0.32);
    else if (/غامق|داكن|محروق|dark|deep|burnt/.test(n)) out = shade(out, -0.32);
  }
  CACHE.set(n, out);
  return out;
}

// ألوان المنتج المتاحة: من مخزون الألوان أو صور الألوان أو حقل اللون النصي (مفصول بفواصل)
export function productColors(p) {
  const set = new Set();
  if (p?.colorStock && Object.keys(p.colorStock).length) Object.keys(p.colorStock).forEach((x) => set.add(x));
  else if (p?.colorImages && Object.keys(p.colorImages).length) Object.keys(p.colorImages).forEach((x) => set.add(x));
  else String(p?.color || '').split(/[,،/|]/).map((x) => x.trim()).filter(Boolean).forEach((x) => set.add(x));
  return [...set];
}

// جاهزة للبطاقة: أسماء + ألوان CSS (تُسقط الأسماء غير المعروفة)
export function productColorDots(p) {
  return productColors(p)
    .map((name) => ({ name, css: colorToCss(name) }))
    .filter((d) => d.css);
}

// أسماء شائعة لاقتراحات الإدخال في لوحة التاجر (datalist)
export const COLOR_SUGGESTIONS = [
  'أسود', 'أبيض', 'أوف وايت', 'بيج', 'نيود', 'كابتشينو', 'موكا', 'لاتيه', 'كراميل', 'بني',
  'شوكولاتة', 'جملي', 'هافان', 'ترابي', 'رملي', 'شوفان', 'سكري', 'كريمي', 'شمبانيا',
  'رمادي', 'رصاصي', 'فحمي', 'فضي', 'ذهبي', 'روز جولد',
  'أحمر', 'خمري', 'برغندي', 'عنابي', 'قرميدي', 'تراكوتا',
  'وردي', 'بيبي بينك', 'بودري', 'نهدي', 'فوشي', 'مرجاني', 'خوخي', 'توتي',
  'بنفسجي', 'موف', 'ليلكي', 'لافندر', 'باذنجاني', 'عودي',
  'كحلي', 'أزرق', 'أزرق ملكي', 'سماوي', 'بيبي بلو', 'لبني', 'نيلي', 'جينز', 'بترولي',
  'تركواز', 'فيروزي', 'تيفاني',
  'أخضر', 'زيتي', 'عسكري', 'كاكي', 'نعناعي', 'ميرمي', 'فستقي', 'زمردي',
  'أصفر', 'ليموني', 'خردلي', 'عسلي', 'برتقالي', 'نحاسي', 'برونزي',
];
