import { Helmet } from 'react-helmet-async';

// مكوّن SEO ديناميكي: يضبط العنوان والوصف ووسوم Open Graph + بيانات Schema.org لكل صفحة/متجر.
// jsonLd (اختياري): كائن بيانات منظّمة (Product/Store...) يظهر بنتائج Google الغنية (سعر/صورة/تقييم).
export default function Seo({ title, description, image, url, type = 'website', jsonLd }) {
  // نتجنّب تكرار الاسم (Bazara — Bazara) على الصفحة الرئيسية
  const fullTitle = !title || title === 'Bazara' ? 'Bazara — وجهتك للأزياء الفاخرة' : `${title} — Bazara`;
  const desc = description || 'Bazara: منصة المتاجر الإلكترونية للأزياء الفاخرة.';
  // النطاق الرسمي (canonical) — نوحّد كل الصفحات عليه حتى لو فُتحت من النطاق القديم،
  // فيركّز Google على bazarastore.site ولا يكرّر الفهرسة.
  const CANON_HOST = 'https://bazarastore.site';
  const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
  const canonical = url || `${CANON_HOST}${here}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {canonical && <link rel="canonical" href={canonical} />}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      {canonical && <meta property="og:url" content={canonical} />}
      {image && <meta property="og:image" content={image} />}

      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      {image && <meta name="twitter:image" content={image} />}

      {/* بيانات منظّمة Schema.org — نتائج Google الغنية */}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
