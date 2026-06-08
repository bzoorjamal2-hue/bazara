// يولّد public/sitemap.xml وقت البناء حتى يُخدَم من Vercel (دائماً صاحٍ) بدل سيرفر Render
// الذي ينام على الخطة المجانية فيفشل جلب الخريطة في Google Search Console.
// على Vercel: نجلب الخريطة الديناميكية من السيرفر (مع مهلة) ونحفظها كملف ثابت.
// محلياً أو عند الفشل: نكتب خريطة احتياطية تحتوي الصفحة الرئيسية فقط (جوجل يكتشف الباقي بالزحف على الروابط).
import { writeFileSync } from 'node:fs';

const OUT = 'public/sitemap.xml';
const HOME = 'https://bazara-alpha.vercel.app/';
const API_SITEMAP = 'https://bazara-hwux.onrender.com/sitemap.xml';

const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${HOME}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

async function run() {
  // محلياً (ليس على Vercel) أو إن لم يتوفر fetch: اكتب الاحتياطي فوراً دون انتظار الشبكة.
  if (!process.env.VERCEL || typeof fetch === 'undefined') {
    writeFileSync(OUT, fallback);
    console.log('sitemap: wrote homepage fallback (local build)');
    return;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000); // نمنح Render وقتاً ليصحو
    const res = await fetch(API_SITEMAP, { signal: ctrl.signal });
    clearTimeout(timer);
    const xml = await res.text();
    if (res.ok && xml.includes('<urlset')) {
      writeFileSync(OUT, xml);
      console.log('sitemap: generated from API (' + xml.length + ' bytes)');
      return;
    }
    throw new Error('unexpected response ' + res.status);
  } catch (e) {
    console.warn('sitemap: using fallback —', e.message);
    writeFileSync(OUT, fallback);
  }
}

run();
