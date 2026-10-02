// بياناتُ صفحةِ المتجرِ لمحرّكاتِ البحث — مصدرٌ واحدٌ لنسختين:
// الصفحةُ المُجهَّزةُ على الحافّة ‏(seo-core.js) وصفحةُ التطبيقِ نفسُه ‏(StorePage).
// كانتا تختلفان: عنوانٌ بلا «Bazara» هنا وبه هناك، ووصفٌ يعرفُ الأقسامَ هنا ولا
// يعرفُها هناك، وانستغرام مكتوبٌ اسمَ حسابٍ مجرّداً لا رابطاً — وجوجل لا يربطُ
// المتجرَ بحسابِه إلّا برابطٍ كامل.
//
// والهدف: من يبحثُ عن اسمِ المتجرِ يجدُ صفحتَه. فالاسمُ بحروفٍ عاديّة، ومعه
// أسماؤُه الأخرى (حسابُ انستغرام ورابطُه المختصر)، ومعه حساباتُه (sameAs) — وهي
// أقوى ما يقولُ لجوجل إنّ «Haboosh Style» هذه هي نفسُها تلك على انستغرام.

const DEPT_PHRASE = { clothing: 'فساتين وأطقم وعبايات', shoes: 'أحذية', accessories: 'إكسسوارات' };

// الاسمُ بحروفٍ يقرؤُها محرّكُ البحث: «𝓗𝓪𝓫𝓸𝓸𝓼𝓱» حروفٌ أخرى بنظرِ يونيكود
export function plainName(s) {
  const raw = String(s || '').trim();
  if (!raw) return '';
  return raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim() || raw;
}

const isUrl = (s) => /^https?:\/\//i.test(String(s || '').trim());

// انستغرام يُحفَظُ اسمَ حسابٍ غالباً ‏(haboosh._style أو ‎@haboosh._style) وأحياناً رابطاً
function igHandle(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const h = (m ? m[1] : s).replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : '';
}

export function storeSeo(store, site) {
  const name = plainName(store.name) || store.slug || '';
  const url = `${site}/store/${store.slug}`;
  const depts = (Array.isArray(store.departments) ? store.departments : [])
    .map((d) => DEPT_PHRASE[d]).filter(Boolean);
  const desc = String(store.description || store.tagline || '').replace(/\s+/g, ' ').trim().slice(0, 300)
    || `${name}: تسوّقي ${depts.join(' و') || DEPT_PHRASE.clothing} أونلاين — توصيل لكل فلسطين والدفع عند الاستلام.`;

  const ig = igHandle(store.instagram);
  const sameAs = [
    ig ? `https://www.instagram.com/${ig}/` : '',
    isUrl(store.facebook) ? String(store.facebook).trim() : '',
    isUrl(store.tiktok) ? String(store.tiktok).trim() : '',
  ].filter(Boolean);
  const lower = name.toLowerCase();
  const alternateName = [...new Set([ig, store.slug].filter((x) => x && x.toLowerCase() !== lower))];
  const phone = String(store.whatsapp || store.phone || '').trim();
  const logo = store.logoUrl || '';

  return {
    name,
    url,
    desc,
    ld: {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name,
      ...(alternateName.length ? { alternateName } : {}),
      url,
      ...(logo ? { image: logo, logo } : {}),
      description: desc,
      ...(phone ? { telephone: phone } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      address: { '@type': 'PostalAddress', addressCountry: 'PS' },
      parentOrganization: { '@type': 'Organization', name: 'Bazara', url: site },
    },
  };
}
