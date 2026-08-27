import { useEffect } from 'react';

// وسومُ الصفحة لمحرّكات البحث والمشاركة: العنوان والوصف وOpen Graph والبيانات
// المنظّمة.
//
// كان هذا يمرّ عبر react-helmet-async، وكانت المكتبة خاملةً تماماً: فحصتُ
// الإنتاج فوجدتُ صفراً من الوسوم تحمل data-rh — أي أنّها لا تدير وسماً واحداً.
// وأثرُ ذلك أنّ كلّ صفحةٍ بالموقع كانت تحمل عنوانَ index.html نفسه ووصفَه:
// الواجهةُ والعروضُ وصفحةُ كلّ متجرٍ وكلّ منتج، عنوانٌ واحدٌ لها جميعاً بنتائج
// جوجل — فلا يُميّز الباحثُ صفحةً عن أخرى، ولا يُفهرَس منتجٌ باسمه.
//
// وبدل تشخيص مكتبةٍ لم تعد تُصان: الوسومُ تُضبط هنا مباشرةً. المهمّة صغيرة
// ومحدّدة (اضبط وسماً، وأعِده كما كان عند الخروج)، ولا تستحقّ اعتماداً خارجياً.

const CANON_HOST = 'https://bazarastore.site';

// يضبط وسماً موجوداً أو ينشئه، ويعيد دالّةً تُرجع ما كان
function setMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  const created = !el;
  const prev = {};
  if (!el) {
    el = document.createElement(attrs.tag || 'meta');
    Object.entries(attrs).forEach(([k, v]) => { if (k !== 'tag' && k !== 'content') el.setAttribute(k, v); });
    document.head.appendChild(el);
  }
  const key = attrs.tag === 'link' ? 'href' : 'content';
  prev[key] = el.getAttribute(key);
  el.setAttribute(key, attrs.content);
  return () => {
    if (created) el.remove();
    else if (prev[key] != null) el.setAttribute(key, prev[key]);
  };
}

export default function Seo({ title, description, image, url, type = 'website', jsonLd }) {
  // نتجنّب تكرار الاسم (Bazara — Bazara) على الصفحة الرئيسية
  const fullTitle = !title || title === 'Bazara' ? 'Bazara — وجهتك للأزياء الفاخرة' : `${title} — Bazara`;
  const desc = description || 'Bazara: منصة المتاجر الإلكترونية للأزياء الفاخرة.';
  const jsonLdStr = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    // النطاق الرسمي: نوحّد كل الصفحات عليه حتى لو فُتحت من نطاقٍ قديم، فيركّز
    // جوجل على bazarastore.site ولا يكرّر الفهرسة.
    const canonical = url || `${CANON_HOST}${window.location.pathname}${window.location.search}`;

    const prevTitle = document.title;
    document.title = fullTitle;

    const undo = [
      setMeta('meta[name="description"]', { name: 'description', content: desc }),
      setMeta('link[rel="canonical"]', { tag: 'link', rel: 'canonical', content: canonical }),
      setMeta('meta[property="og:type"]', { property: 'og:type', content: type }),
      setMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle }),
      setMeta('meta[property="og:description"]', { property: 'og:description', content: desc }),
      setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical }),
      setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' }),
      setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle }),
      setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: desc }),
    ];
    if (image) {
      undo.push(setMeta('meta[property="og:image"]', { property: 'og:image', content: image }));
      undo.push(setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image }));
    }

    // البيانات المنظّمة (Product/Store…) — نتائج جوجل الغنية. نُعلّمها بسمةٍ
    // خاصّة كي نحذف ما وضعناه نحن ولا نمسّ ما بالـHTML الأصلي.
    let ld;
    if (jsonLdStr) {
      ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.dataset.seo = '1';
      ld.textContent = jsonLdStr;
      document.head.appendChild(ld);
    }

    return () => {
      document.title = prevTitle;
      undo.forEach((f) => f());
      if (ld) ld.remove();
    };
  }, [fullTitle, desc, image, url, type, jsonLdStr]);

  return null;
}
