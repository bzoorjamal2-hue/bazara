import { query } from '../config/db.js';
import { activeStoreSql } from '../utils/subscription.js';
import { videoPoster, productPath } from '../utils/media.js';
import { plainName, storeDescription } from '../utils/plainName.js';

const site = () => (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');

function escapeXml(str = '') {
  return String(str).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

// robots.txt يشير إلى sitemap
export function robots(_req, res) {
  const base = site();
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`
  );
}

// sitemap.xml ديناميكي يضم الصفحات الرئيسية + كل المتاجر + كل المنتجات
export async function sitemap(_req, res, next) {
  try {
    const base = site();
    const active = activeStoreSql('u');
    const stores = await query(
      `SELECT s.slug, s.updated_at FROM stores s JOIN users u ON u.id = s.user_id WHERE ${active} ORDER BY s.updated_at DESC`
    );
    const products = await query(
      `SELECT p.id, p.updated_at, s.slug FROM products p JOIN stores s ON s.id = p.store_id JOIN users u ON u.id = s.user_id WHERE ${active} ORDER BY p.updated_at DESC`
    );

    const urls = [];
    urls.push({ loc: `${base}/`, priority: '1.0' });

    stores.rows.forEach((s) => {
      urls.push({ loc: `${base}/store/${s.slug}`, lastmod: s.updated_at, priority: '0.8' });
    });
    products.rows.forEach((p) => {
      urls.push({ loc: `${base}${productPath(p.slug, p.id)}`, lastmod: p.updated_at, priority: '0.6' });
    });

    const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map((u) => {
          const lastmod = u.lastmod ? `    <lastmod>${new Date(u.lastmod).toISOString()}</lastmod>\n` : '';
          return `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n${lastmod}    <priority>${u.priority}</priority>\n  </url>`;
        })
        .join('\n') +
      `\n</urlset>\n`;

    res.type('application/xml').send(body);
  } catch (err) {
    next(err);
  }
}

// ───────────────────── صفحات المشاركة (Open Graph) ─────────────────────
// المتصفّحات الاجتماعية (واتساب/فيسبوك) لا تشغّل JS، فلا ترى وسوم الـ SPA.
// لذا نخدم صفحة HTML خفيفة بوسوم OG حقيقية (صورة المنتج/المتجر) ثم نعيد التوجيه
// لصفحة الـ SPA. الرابط يبقى على دومين الموقع عبر إعادة كتابة Vercel لـ /share/*.

// صورة محسّنة من Cloudinary لمعاينة المشاركة (عرض 1200، jpg)
function ogImage(url) {
  if (!url) return '';
  if (url.includes('/video/')) return url; // ملصق فيديو جاهز
  // التحويلُ يُبنى من المعرّفِ النظيفِ: الروابطُ تُخزَّنُ محوّلةً منذ الرفعِ
  // ‏(q_auto:best,dpr_auto)، فحقنُ تحويلٍ فوقَها يُنتِجُ سلسلةً تغلبُ فيها الجودةُ
  // المخزَّنةُ على المطلوبة — صورةُ معاينةٍ بأضعافِ حجمِها تتأخّرُ أو يتخطّاها
  // فيسبوك. وهي علّةُ الواجهةِ نفسُها بموضعٍ آخر.
  const m = url.match(/^(https?:\/\/[^/]+\/[^/]+\/image\/upload\/)(.+)$/);
  if (m) {
    const segs = m[2].split('/');
    let vi = segs.findIndex((x) => /^v\d+$/.test(x));
    if (vi === -1) vi = segs.length - 1;
    return `${m[1]}f_jpg,q_auto,w_1200,c_limit/${segs.slice(vi).join('/')}`;
  }
  if (url.includes('/upload/')) return url.replace('/upload/', '/upload/f_jpg,q_auto,w_1200,c_limit/');
  return url;
}


// البياناتُ المنظَّمةُ داخلَ وسمِ ‎script: وصفٌ يحوي ‎</script> يُغلِقُ الوسمَ
// ويكسرُ الصفحة. نهربُ من كلِّ ‎< إلى ‎< — وهو سليمٌ داخلَ JSON ويقرؤُه
// المحلّلُ كما هو. والتاجرةُ تكتبُ وصفَ متجرِها بحرّيّة.
const ldJson = (o) => JSON.stringify(o).split(String.fromCharCode(60)).join(String.fromCharCode(92) + "u003c");
function shareHtml({ title, desc, image, url, type = 'website', siteName = 'Bazara', ld = null }) {
  const t = escapeXml(title), d = escapeXml(desc), img = escapeXml(image), u = escapeXml(url), sn = escapeXml(siteName);
  // تحويل فوري عبر meta refresh (يعمل بلا JS — متصفّح انستغرام/فيسبوك المدمج يوقف
  // بعض الـ JS فكانت تظهر صفحة شبه فارغة). الزواحف الاجتماعية تقرأ وسوم OG قبل التحويل.
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=${u}">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:site_name" content="${sn}">
${img ? `<meta property="og:image" content="${img}">\n<meta property="og:image:width" content="1200">` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${img ? `<meta name="twitter:image" content="${img}">` : ''}
<link rel="canonical" href="${u}">
${ld ? `<script type="application/ld+json">${ldJson(ld)}</script>` : ''}
</head><body style="font-family:sans-serif;background:#FAF9F7;color:#1F1E1D;text-align:center;padding:40px">
<script>location.replace(${JSON.stringify(url)})</script>
<p>جارٍ التحويل… <a href="${u}">${t}</a></p>
</body></html>`;
}

export async function shareProduct(req, res, next) {
  const { id } = req.params;
  let url = `${site()}/product/${id}`;
  try {
    const active = activeStoreSql('u');
    const r = await query(
      `SELECT p.name, p.description, p.price, p.image_url, p.images, p.video_url, s.name AS store_name, s.slug
       FROM products p JOIN stores s ON s.id = p.store_id JOIN users u ON u.id = s.user_id
       WHERE p.id = $1 AND ${active}`,
      [id]
    );
    const p = r.rows[0];
    if (!p) return res.redirect(302, url);
    url = `${site()}${productPath(p.slug, id)}`; // الرابطُ المعياريُّ: باسمِ المتجر
    let img = p.image_url || (Array.isArray(p.images) && p.images[0]) || '';
    if (!img && p.video_url) img = videoPoster(p.video_url);
    res.set('Cache-Control', 'public, max-age=300').type('html').send(shareHtml({
      title: `${p.name} — ${plainName(p.store_name)}`,
      desc: (p.description || '').replace(/\s+/g, ' ').trim().slice(0, 160) || `₪${Number(p.price)} — ${p.store_name}`,
      image: ogImage(img),
      url,
      type: 'product',
      siteName: plainName(p.store_name),
    }));
  } catch { res.redirect(302, url); } // أي خطأ (مثل معرّف غير صالح) → توجيه للصفحة بدل خطأ 500
}

export async function shareStore(req, res, next) {
  const { slug } = req.params;
  // نحافظ على كود الإحالة (ref) في التوجيه ليبقى الخصم فعّالاً للزبونة الجديدة
  const ref = String(req.query.ref || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
  const url = `${site()}/store/${slug}${ref ? `?ref=${ref}` : ''}`;
  try {
    const active = activeStoreSql('u');
    const r = await query(
      `SELECT s.name, s.description, s.logo_url, s.whatsapp, s.phone FROM stores s JOIN users u ON u.id = s.user_id WHERE s.slug = $1 AND ${active}`,
      [slug]
    );
    const s = r.rows[0];
    if (!s) return res.redirect(302, url);
    // الاسمُ بحروفٍ يقرؤُها محرّكُ البحث: «𝓗𝓪𝓫𝓸𝓸𝓼𝓱» حروفٌ أخرى بنظرِ يونيكود
    // ‏(U+1D4D7) لا علاقةَ لها بـH اللاتينيّة، فمن يبحثُ عن «Haboosh» لا يطابقُ
    // شيئاً. والشكلُ المعروضُ داخلَ المتجرِ لا يتغيّر — هذا للعنوانِ وحدَه.
    const name = plainName(s.name);
    const logo = ogImage(s.logo_url || '');
    res.set('Cache-Control', 'public, max-age=300').type('html').send(shareHtml({
      title: name,
      // وصفٌ لكلِّ متجرٍ وصفُه: كان «الاسم — أزياء فاخرة» على كلِّ متاجرِ
      // المنصّة، ومحرّكُ البحثِ يخفضُ ترتيبَ الأوصافِ المكرّرة.
      desc: storeDescription(s.name, s.description),
      image: logo,
      url,
      siteName: name,
      // بياناتٌ منظَّمةٌ يفهمُها جوجل: منها يبني بطاقةَ النتيجةِ بدل اقتطاعِ سطر
      ld: {
        '@context': 'https://schema.org',
        '@type': 'Store',
        name,
        url,
        ...(logo ? { image: logo, logo } : {}),
        ...(s.description ? { description: String(s.description).replace(/\s+/g, ' ').trim().slice(0, 300) } : {}),
        ...(s.whatsapp || s.phone ? { telephone: String(s.whatsapp || s.phone) } : {}),
        address: { '@type': 'PostalAddress', addressCountry: 'PS' },
        parentOrganization: { '@type': 'Organization', name: 'Bazara', url: site() },
      },
    }));
  } catch { res.redirect(302, url); }
}

// صفحة مشاركة الستوري: معاينة بصورة الستوري، والضغط يوجّه للمنتج المربوط أو المتجر
export async function shareStory(req, res, next) {
  const { id } = req.params;
  try {
    const active = activeStoreSql('u');
    const r = await query(
      `SELECT st.media_url, st.media_type, st.product_id, st.caption, s.slug, s.name AS store_name
       FROM stories st JOIN stores s ON s.id = st.store_id JOIN users u ON u.id = s.user_id
       WHERE st.id = $1 AND st.expires_at > now() AND ${active}`,
      [id]
    );
    const st = r.rows[0];
    if (!st) return res.redirect(302, site() || '/');
    const url = st.product_id ? `${site()}${productPath(st.slug, st.product_id)}` : `${site()}/store/${st.slug}`;
    let img = st.media_url || '';
    if (st.media_type === 'video') img = videoPoster(img);
    res.set('Cache-Control', 'public, max-age=300').type('html').send(shareHtml({
      title: `${plainName(st.store_name)} — ستوري`,
      desc: (st.caption || '').replace(/\s+/g, ' ').trim().slice(0, 160) || st.store_name,
      image: ogImage(img),
      url,
      siteName: plainName(st.store_name),
    }));
  } catch { res.redirect(302, site() || '/'); }
}

// ملف مفتاح IndexNow الذي تطلبه محركات البحث للتحقق
export function indexNowKey(req, res) {
  const key = process.env.INDEXNOW_KEY;
  const requested = req.params.key;
  if (!key || requested !== `${key}.txt`) {
    return res.status(404).send('Not found');
  }
  res.type('text/plain').send(key);
}
