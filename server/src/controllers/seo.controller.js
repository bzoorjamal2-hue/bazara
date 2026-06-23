import { query } from '../config/db.js';
import { activeStoreSql } from '../utils/subscription.js';

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
      `SELECT p.id, p.updated_at FROM products p JOIN stores s ON s.id = p.store_id JOIN users u ON u.id = s.user_id WHERE ${active} ORDER BY p.updated_at DESC`
    );

    const urls = [];
    urls.push({ loc: `${base}/`, priority: '1.0' });

    stores.rows.forEach((s) => {
      urls.push({ loc: `${base}/store/${s.slug}`, lastmod: s.updated_at, priority: '0.8' });
    });
    products.rows.forEach((p) => {
      urls.push({ loc: `${base}/product/${p.id}`, lastmod: p.updated_at, priority: '0.6' });
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
  if (url.includes('/image/upload/')) return url.replace('/image/upload/', '/image/upload/f_jpg,q_auto,w_1200,c_limit/');
  if (url.includes('/upload/')) return url.replace('/upload/', '/upload/f_jpg,q_auto,w_1200,c_limit/');
  return url;
}

function shareHtml({ title, desc, image, url, type = 'website' }) {
  const t = escapeXml(title), d = escapeXml(desc), img = escapeXml(image), u = escapeXml(url);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:site_name" content="Bazara">
${img ? `<meta property="og:image" content="${img}">\n<meta property="og:image:width" content="1200">` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${img ? `<meta name="twitter:image" content="${img}">` : ''}
<link rel="canonical" href="${u}">
<meta http-equiv="refresh" content="0; url=${u}">
</head><body style="font-family:sans-serif;background:#F4EDE2;color:#5e4636;text-align:center;padding:40px">
<script>location.replace(${JSON.stringify(url)})</script>
<p><a href="${u}">${t}</a></p>
</body></html>`;
}

export async function shareProduct(req, res, next) {
  const { id } = req.params;
  const url = `${site()}/product/${id}`;
  try {
    const active = activeStoreSql('u');
    const r = await query(
      `SELECT p.name, p.description, p.price, p.image_url, p.images, p.video_url, s.name AS store_name
       FROM products p JOIN stores s ON s.id = p.store_id JOIN users u ON u.id = s.user_id
       WHERE p.id = $1 AND ${active}`,
      [id]
    );
    const p = r.rows[0];
    if (!p) return res.redirect(302, url);
    let img = p.image_url || (Array.isArray(p.images) && p.images[0]) || '';
    if (!img && p.video_url && p.video_url.includes('/video/upload/')) {
      img = p.video_url.replace('/video/upload/', '/video/upload/so_0/').replace(/\.[a-z0-9]+($|\?.*$)/i, '.jpg');
    }
    res.set('Cache-Control', 'public, max-age=300').type('html').send(shareHtml({
      title: `${p.name} — ${p.store_name}`,
      desc: (p.description || '').replace(/\s+/g, ' ').trim().slice(0, 160) || `₪${Number(p.price)} — ${p.store_name}`,
      image: ogImage(img),
      url,
      type: 'product',
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
      `SELECT s.name, s.description, s.logo_url FROM stores s JOIN users u ON u.id = s.user_id WHERE s.slug = $1 AND ${active}`,
      [slug]
    );
    const s = r.rows[0];
    if (!s) return res.redirect(302, url);
    res.set('Cache-Control', 'public, max-age=300').type('html').send(shareHtml({
      title: s.name,
      desc: (s.description || '').replace(/\s+/g, ' ').trim().slice(0, 160) || `${s.name} — ${'أزياء فاخرة'}`,
      image: ogImage(s.logo_url || ''),
      url,
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
    const url = st.product_id ? `${site()}/product/${st.product_id}` : `${site()}/store/${st.slug}`;
    let img = st.media_url || '';
    if (st.media_type === 'video' && img.includes('/video/upload/')) {
      img = img.replace('/video/upload/', '/video/upload/so_0/').replace(/\.[a-z0-9]+($|\?.*$)/i, '.jpg');
    }
    res.set('Cache-Control', 'public, max-age=300').type('html').send(shareHtml({
      title: `${st.store_name} — ستوري`,
      desc: (st.caption || '').replace(/\s+/g, ' ').trim().slice(0, 160) || st.store_name,
      image: ogImage(img),
      url,
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
