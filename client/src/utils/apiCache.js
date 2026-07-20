// مخزّن صفحات (منتج/متجر/فئة/رئيسية) — يجعل الفتح/الرجوع فورياً وثابتاً بلا وميض،
// ويثبّت استعادة موضع التمرير لأن المحتوى يجهز لحظياً. (stale-while-revalidate)
// نحفظ في الذاكرة + localStorage فيبقى المحتوى فورياً حتى بعد إعادة تحميل التطبيق.
const mem = new Map();
const TTL = 5 * 60 * 1000; // 5 دقائق
const LS_PREFIX = 'bzc_';
const LS_MAX = 350000; // حد حجم العنصر الواحد بالـ localStorage (~350KB) لتفادي امتلاء التخزين

export function getCache(key) {
  const e = mem.get(key);
  if (e) {
    if (Date.now() - e.t <= TTL) return e.v;
    mem.delete(key);
  }
  // محاولة من التخزين الدائم (يبقى بعد إعادة التحميل)
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.t <= TTL) { mem.set(key, parsed); return parsed.v; }
      localStorage.removeItem(LS_PREFIX + key);
    }
  } catch { /* تجاهل */ }
  return null;
}

// تفريغ عناصر الكاش التي تبدأ بأيٍّ من البادئات (ذاكرة + localStorage) —
// يُستدعى بعد حذف/تعديل منتج كي لا تعرض الصفحات العامة (الرئيسية/المتجر/الفئات)
// محتوى قديماً حتى انتهاء صلاحية الكاش (5 دقائق)
export function clearCachePrefixes(prefixes) {
  for (const k of [...mem.keys()]) { if (prefixes.some((p) => k.startsWith(p))) mem.delete(k); }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX) && prefixes.some((p) => k.slice(LS_PREFIX.length).startsWith(p))) localStorage.removeItem(k);
    }
  } catch { /* تجاهل */ }
}

export function setCache(key, value) {
  const entry = { v: value, t: Date.now() };
  mem.set(key, entry);
  try {
    const s = JSON.stringify(entry);
    if (s.length <= LS_MAX) localStorage.setItem(LS_PREFIX + key, s);
    else localStorage.removeItem(LS_PREFIX + key); // كبير جداً → لا نحفظه دائماً (تبقى نسخة الذاكرة)
  } catch {
    // امتلأ التخزين → ننظّف كل عناصر الكاش القديمة ونحاول مرة أخرى بهدوء
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
      }
    } catch { /* تجاهل */ }
  }
}
