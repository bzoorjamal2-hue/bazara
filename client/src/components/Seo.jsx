import { Helmet } from 'react-helmet-async';

// مكوّن SEO ديناميكي: يضبط العنوان والوصف ووسوم Open Graph لكل صفحة/متجر.
export default function Seo({ title, description, image, url, type = 'website' }) {
  // نتجنّب تكرار الاسم (Bazara — Bazara) على الصفحة الرئيسية
  const fullTitle = !title || title === 'Bazara' ? 'Bazara — وجهتك للأزياء الفاخرة' : `${title} — Bazara`;
  const desc = description || 'Bazara: منصة المتاجر الإلكترونية للأزياء الفاخرة.';
  const canonical = url || (typeof window !== 'undefined' ? window.location.href : '');

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
    </Helmet>
  );
}
