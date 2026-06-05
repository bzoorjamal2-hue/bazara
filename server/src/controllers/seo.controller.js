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

// ملف مفتاح IndexNow الذي تطلبه محركات البحث للتحقق
export function indexNowKey(req, res) {
  const key = process.env.INDEXNOW_KEY;
  const requested = req.params.key;
  if (!key || requested !== `${key}.txt`) {
    return res.status(404).send('Not found');
  }
  res.type('text/plain').send(key);
}
