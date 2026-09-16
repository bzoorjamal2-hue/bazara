// خريطةُ الموقعِ حيّةً لا مولَّدةً وقتَ البناء.
//
// كانت ملفّاً ثابتاً يُكتَبُ بـ‎prebuild من الخادمِ مرّةً واحدة. فمتجرٌ تفتحُه
// تاجرةٌ اليومَ لا يدخلُ الخريطةَ حتّى يُدفَعَ كودٌ جديد — وقد لا يُدفَعُ
// أسابيع. ومنصّةٌ تنضمُّ إليها المتاجرُ بنفسِها لا يصحُّ أن يتوقّفَ ظهورُها
// بمحرّكِ البحثِ على نشرةٍ برمجيّة.
//
// والخادمُ يبني الخريطةَ من قاعدةِ البياناتِ فعلاً — فنقرؤُها منه ونخزّنُها
// على الحافّةِ ساعةً. فإن نامَ الخادمُ ‏(الخطّةُ المجانيّةُ تُنيمُه) أو تأخّر،
// رجعنا إلى الملفِّ الثابتِ المبنيِّ مع النشرة: خريطةٌ قديمةٌ بعضَ الشيءِ خيرٌ
// من صفحةِ خطأٍ بوجهِ زاحفٍ يزورُنا مرّةً كلَّ أسابيع.

const API_SITEMAP = 'https://api.bazarastore.site/sitemap.xml';
const SITE = 'https://bazarastore.site';

export default async function handler(req, res) {
  const send = (xml, source) => res
    .status(200)
    .setHeader('content-type', 'application/xml; charset=utf-8')
    // ساعةٌ على الحافّةِ ويومٌ بالبيانِ القديمِ أثناءَ التحديث: الزواحفُ لا
    // تحتاجُ أحدثَ من ساعة، والخادمُ لا يُوقَظُ مع كلِّ زيارة.
    .setHeader('cache-control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400')
    .setHeader('x-bz-sitemap', source)
    .send(xml);

  try {
    const ctrl = new AbortController();
    // مهلةٌ سخيّةٌ تكفي لإيقاظِ خادمٍ نائمٍ دونَ أن تُعلِّقَ الطلبَ طويلاً
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(API_SITEMAP, { signal: ctrl.signal, headers: { accept: 'application/xml' } });
    clearTimeout(timer);
    const xml = await r.text();
    if (r.ok && xml.includes('<urlset')) return send(xml, 'live');
    throw new Error(`status ${r.status}`);
  } catch {
    // الملفُّ الثابتُ المبنيُّ مع النشرة — موجودٌ دائماً
    try {
      const r = await fetch(`${SITE}/sitemap-build.xml`);
      const xml = await r.text();
      if (r.ok && xml.includes('<urlset')) return send(xml, 'build');
    } catch { /* وحتّى هذا تعذّر */ }
    // آخرُ ما يُرَدّ: الصفحةُ الرئيسيّةُ وحدَها — يكتشفُ الزاحفُ الباقيَ بالروابط
    return send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${SITE}/</loc>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n`,
      'fallback',
    );
  }
}
