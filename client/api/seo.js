// صفحةُ متجرٍ ومنتجٍ بمحتواها مكتوباً بالـHTML لا مبنيّاً بالجافاسكربت.
//
// المشكلةُ التي تحلُّها: صفحاتُ التطبيقِ قشرةٌ فارغةٌ حتّى يعملَ الجافاسكربت.
// قِستُها على الإنتاج: صفحةُ منتجٍ تصلُ الزاحفَ بخمسةٍ وخمسين حرفاً من النصِّ
// المرئيّ، كلُّها كلمةُ ‎«Bazara» وكودُ حركة، وبعنوانِ المنصّةِ العامِّ نفسِه —
// ثلاثونَ رابطاً بصفحةٍ واحدةٍ متطابقة. فقالت أدواتُ جوجل: «تمّ اكتشافُ
// الصفحة — لم تتم فهرستُها» لعشرينَ منها. وهي تشغّلُ الجافاسكربتَ لكن بطابورٍ
// ثانٍ، وموقعٌ جديدٌ يبقى آخرَه.
//
// ولماذا لا نخدمُ هذا للزاحفِ وحدَه؟ لأنّ إعطاءَ محرّكِ البحثِ غيرَ ما يُعطى
// الناسُ تمويهٌ يُعاقَبُ عليه. فنخدمُه للجميع: المحتوى نفسُه داخلَ جذرِ
// التطبيق، ثمّ يقلعُ التطبيقُ فوقَه ويستبدلُه بالصفحةِ الحيّة. والزائرُ يكسبُ
// أيضاً: يرى اسمَ المتجرِ وبضاعتَه قبلَ أن تصلَ حزمةُ الجافاسكربت.
//
// ولماذا على Vercel لا على خادمِ Render؟ لأنّ الخطّةَ المجانيّةَ تُنيمُ Render،
// فزيارةُ زاحفٍ وهو نائمٌ مهلةٌ فاشلة — أسوأُ من قشرةٍ فارغةٍ تصلُ بسرعة.

const API = 'https://api.bazarastore.site/api';
const SITE = 'https://bazarastore.site';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ‏< داخلَ JSON‑LD يُهرَب: وصفٌ فيه ‎</script> يُغلِقُ الوسمَ ويكسرُ الصفحة
const ldJson = (o) => JSON.stringify(o)
  .split(String.fromCharCode(60))
  .join(String.fromCharCode(92) + 'u003c');

// الاسمُ بحروفٍ يقرؤُها محرّكُ البحث: «𝓗𝓪𝓫𝓸𝓸𝓼𝓱» حروفٌ أخرى بنظرِ يونيكود
const plain = (s) => {
  const raw = String(s || '').trim();
  if (!raw) return '';
  return raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim() || raw;
};

// صورةٌ بمقاسِ المعاينة، مبنيّةٌ من المعرّفِ النظيفِ فلا تتسلسلُ فوقَ تحويلٍ مخزَّن
const img = (url, w = 1200) => {
  const s = String(url || '');
  const m = s.match(/^(https?:\/\/[^/]+\/[^/]+\/(image|video)\/upload\/)(.+)$/);
  if (!m) return s;
  const segs = m[3].split('/');
  let vi = segs.findIndex((x) => /^v\d+$/.test(x));
  if (vi === -1) vi = segs.length - 1;
  const rest = segs.slice(vi).join('/').replace(/\.[a-z0-9]+$/i, '');
  const frame = m[2] === 'video' ? 'so_0,' : '';
  return `${m[1]}${frame}f_jpg,q_auto,w_${w},c_limit/${rest}.jpg`;
};

const money = (n) => `₪${Number(n || 0).toFixed(2)}`;

// يحقنُ الرأسَ والمحتوى في قشرةِ التطبيقِ المبنيّةِ نفسِها — لا نُنشئُ صفحةً
// موازيةً تتخلّفُ عن البناء: نفسُ الحزمِ ونفسُ الوسومِ ونفسُ كلِّ شيءٍ آخر.
function inject(shell, { title, desc, image, url, ld, body }) {
  let out = shell;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  out = out.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(desc)}">`);
  out = out.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${esc(title)}">`);
  out = out.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${esc(desc)}">`);
  out = out.replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${esc(url)}">`);
  if (image) out = out.replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${esc(image)}">`);

  // ‏canonical يُستبدَلُ لا يُضاف: القشرةُ تحملُ واحداً يشيرُ إلى الصفحةِ
  // الرئيسيّة، فلو تُرِكَ لقالت كلُّ صفحةِ متجرٍ ومنتجٍ لجوجل «أنا نسخةٌ من
  // الرئيسيّة» — فتسقطُ كلُّها من الفهرسِ بوصفِها مكرّرة. وهذا أسوأُ بكثيرٍ
  // من القشرةِ الفارغةِ التي جئنا نداويها. كشفَه اختبارُ الدالّةِ قبلَ الدفع.
  out = out.replace(/<link\s+rel="canonical"[^>]*>/i, '');
  const head = [
    `<link rel="canonical" href="${esc(url)}">`,
    ld ? `<script type="application/ld+json">${ldJson(ld)}</script>` : '',
  ].filter(Boolean).join('\n');
  out = out.replace('</head>', `${head}\n</head>`);

  // المحتوى داخلَ جذرِ التطبيق: يراه الزاحفُ ويراه الزائرُ قبلَ إقلاعِ التطبيق،
  // ثمّ يستبدلُه ‎React عندَ التركيب. ‎bz-pre يُخفيه فورَ إقلاعِ التطبيقِ لو تأخّر.
  out = out.replace(/(<div id="root")([^>]*)(>)/i, `$1$2$3<div class="bz-pre">${body}</div>`);
  return out;
}

async function get(path) {
  const r = await fetch(`${API}${path}`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`api ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  const url = new URL(req.url, SITE);
  const parts = url.pathname.split('/').filter(Boolean); // store / <slug> [/ product / <id>]
  const slug = parts[1] || '';
  const productId = parts[2] === 'product' ? parts[3] : '';

  // القشرةُ المبنيّةُ كما هي على الحافّة — بلا قراءةِ ملفٍّ من القرص
  let shell;
  try {
    const r = await fetch(`${SITE}/index.html`, { headers: { 'x-bz-shell': '1' } });
    shell = await r.text();
  } catch {
    return res.status(302).setHeader('Location', url.pathname).end();
  }

  try {
    const data = await get(`/public/store/${encodeURIComponent(slug)}`);
    const store = data.store || {};
    if (!store.slug) throw new Error('no store');
    const products = Array.isArray(data.products) ? data.products : [];
    const name = plain(store.name);

    if (productId) {
      const p = products.find((x) => x.id === productId)
        || (await get(`/public/product/${encodeURIComponent(productId)}`)).product;
      if (!p) throw new Error('no product');
      const pUrl = `${SITE}/store/${store.slug}/product/${p.id}`;
      const pImg = img(p.imageUrl || (p.images || [])[0] || p.videoUrl || store.logoUrl);
      const desc = String(p.description || '').replace(/\s+/g, ' ').trim().slice(0, 300)
        || `${p.name} من ${name} — ${money(p.price)}. توصيل لكل فلسطين والدفع عند الاستلام.`;
      return res.status(200)
        .setHeader('content-type', 'text/html; charset=utf-8')
        .setHeader('cache-control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400')
        .send(inject(shell, {
          title: `${p.name} — ${name}`,
          desc,
          image: pImg,
          url: pUrl,
          ld: {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: p.name,
            ...(p.description ? { description: String(p.description).replace(/\s+/g, ' ').trim().slice(0, 500) } : {}),
            ...(pImg ? { image: pImg } : {}),
            ...(p.color ? { color: p.color } : {}),
            brand: { '@type': 'Brand', name },
            offers: {
              '@type': 'Offer',
              price: Number(p.price || 0).toFixed(2),
              priceCurrency: 'ILS',
              availability: 'https://schema.org/InStock',
              url: pUrl,
              seller: { '@type': 'Store', name },
            },
          },
          body: [
            `<h1>${esc(p.name)}</h1>`,
            `<p>${esc(money(p.price))}${p.oldPrice ? ` <s>${esc(money(p.oldPrice))}</s>` : ''}</p>`,
            p.description ? `<p>${esc(String(p.description).slice(0, 600))}</p>` : '',
            p.size ? `<p>المقاسات: ${esc(p.size)}</p>` : '',
            p.color ? `<p>الألوان: ${esc(p.color)}</p>` : '',
            pImg ? `<img src="${esc(pImg)}" alt="${esc(p.name)}" width="600">` : '',
            `<p><a href="/store/${esc(store.slug)}">${esc(name)}</a></p>`,
          ].filter(Boolean).join('\n'),
        }));
    }

    // صفحةُ المتجر
    const storeUrl = `${SITE}/store/${store.slug}`;
    const logo = img(store.logoUrl, 1200);
    const desc = String(store.description || '').replace(/\s+/g, ' ').trim().slice(0, 300)
      || `${name}: تسوّقي فساتين وأطقم وعبايات — توصيل لكل فلسطين والدفع عند الاستلام.`;
    return res.status(200)
      .setHeader('content-type', 'text/html; charset=utf-8')
      .setHeader('cache-control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400')
      .send(inject(shell, {
        title: name,
        desc,
        image: logo,
        url: storeUrl,
        ld: {
          '@context': 'https://schema.org',
          '@type': 'Store',
          name,
          url: storeUrl,
          ...(logo ? { image: logo, logo } : {}),
          ...(store.description ? { description: desc } : {}),
          ...(store.whatsapp || store.phone ? { telephone: String(store.whatsapp || store.phone) } : {}),
          address: { '@type': 'PostalAddress', addressCountry: 'PS' },
          parentOrganization: { '@type': 'Organization', name: 'Bazara', url: SITE },
        },
        body: [
          `<h1>${esc(name)}</h1>`,
          `<p>${esc(desc)}</p>`,
          products.length ? '<h2>المنتجات</h2><ul>' + products.slice(0, 40).map((p) => (
            `<li><a href="/store/${esc(store.slug)}/product/${esc(p.id)}">${esc(p.name)}</a> — ${esc(money(p.price))}</li>`
          )).join('\n') + '</ul>' : '',
        ].filter(Boolean).join('\n'),
      }));
  } catch {
    // أيُّ تعذّرٍ ‏(متجرٌ محذوفٌ · الخادمُ نائم) → القشرةُ كما هي، فيُقلِعُ التطبيقُ
    // ويتصرّف. لا نُرجِعُ خطأً: صفحةٌ تعملُ خيرٌ من خمسِ مئةٍ بوجهِ زائرٍ أو زاحف.
    return res.status(200).setHeader('content-type', 'text/html; charset=utf-8').send(shell);
  }
}
