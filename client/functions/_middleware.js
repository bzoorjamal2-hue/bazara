// الموقعُ على Cloudflare Pages — ما كان يفعلُه ‎vercel.json‎ (التحويلاتُ والدوالّ) هنا.
//
// لا يعملُ هذا إلّا على المساراتِ المذكورةِ بـ‎public/_routes.json‎: ملفّاتُ الموقعِ
// الثابتةُ (الحزمُ والصورُ والخطوط) تُخدَمُ من الحافّةِ مباشرةً بلا أيِّ دالّة —
// فلا تُحسَبُ على حدِّ الطلباتِ اليوميِّ المجانيّ ولا تتأخّرُ بمرورِها هنا.
//
// بالترتيبِ نفسِه الذي كان بـ‎vercel.json‎:
//  ١. ‎/api/*‎ و‎/share/*‎ ← خادمُ Render كما هي.
//  ٢. روبوتاتُ المعاينة (واتساب، فيسبوك…) على رابطِ متجرٍ أو منتج ← صفحةُ المعاينةِ من الخادم.
//  ٣. ‎/sitemap.xml‎ ← الخريطةُ الحيّة.
//  ٤. ‎/store/<slug>‎ و‎/store/<slug>/product/<id>‎ ← الصفحةُ بمحتواها لمحرّكِ البحث.
//  وغيرُ ذلك ← ملفّاتُ الموقع، وما لا ملفَّ له يرجعُ ‎index.html‎ (تطبيقُ صفحةٍ واحدة).
import { renderSeo } from '../edge/seo-core.js';
import { renderSitemap } from '../edge/sitemap-core.js';

const RENDER = 'https://bazara-hwux.onrender.com';
const PREVIEW_BOTS = /facebookexternalhit|whatsapp|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|pinterest|embedly|vkshare|redditbot|skypeuripreview/i;

// يمرّرُ الطلبَ كما هو (الطريقة والترويسات والجسم) ويعيدُ الردَّ كما هو
function proxy(request, target) {
  return fetch(new Request(target, request), { redirect: 'manual' });
}

const toResponse = (out) => new Response(out.body, { status: out.status, headers: out.headers });

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // ملفّاتُ البناء (/assets/*) أسماؤُها ببصمةِ محتواها، فتُخزَّنُ سنةً كاملة. وملفٌّ
  // غيرُ موجودٍ كانت Pages تُجيبُه بالصفحةِ الرئيسيّة (سلوكُ التطبيقِ أحاديِّ الصفحة)
  // بـ200 — فإن سُئلَ عن ملفِّ تنسيقٍ جديدٍ في الثواني التي لم ينتشرْ فيها النشرُ بعدُ
  // على كلِّ خوادمِ كلاودفلير، خُزِّنت الصفحةُ مكانَه سنةً والموقعُ بلا تنسيق (حدثَ
  // فعلاً بنشرِ ٤ تشرين). الآن: المفقودُ هنا «غيرُ موجود» صريحٌ لا يُخزَّن، فيُعادُ
  // طلبُه بعد ثوانٍ ويصلُ الملفُّ الصحيح.
  if (path.startsWith('/assets/')) {
    const res = await next();
    if ((res.headers.get('content-type') || '').includes('text/html')) {
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    return res;
  }

  if (path.startsWith('/api/') || path.startsWith('/share/')) {
    return proxy(request, RENDER + path + url.search);
  }

  const store = /^\/store\/([^/]+)\/?$/.exec(path);
  const product = /^\/store\/([^/]+)\/product\/([^/]+)\/?$/.exec(path);
  const legacyProduct = /^\/product\/([^/]+)\/?$/.exec(path);

  if (PREVIEW_BOTS.test(request.headers.get('user-agent') || '')) {
    if (store) return proxy(request, `${RENDER}/share/store/${store[1]}`);
    if (product) return proxy(request, `${RENDER}/share/product/${product[2]}`);
    if (legacyProduct) return proxy(request, `${RENDER}/share/product/${legacyProduct[1]}`);
  }

  if (path === '/sitemap.xml') {
    return toResponse(await renderSitemap(() => env.ASSETS.fetch(new URL('/sitemap-build.xml', url))));
  }

  if (store || product) {
    // ‏‎/‎ لا ‎/index.html‎: الحافّةُ تحوّلُ ‎/index.html‎ إلى ‎/‎ بتحويلةٍ لا بالصفحة
    const shellRes = await env.ASSETS.fetch(new URL('/', url));
    if (!shellRes.ok) return next();
    return toResponse(await renderSeo(path, await shellRes.text()));
  }

  return next();
}
