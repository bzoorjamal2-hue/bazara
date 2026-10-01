// محوّلُ Vercel لصفحةِ المتجرِ والمنتجِ بمحتواها — المنطقُ كلُّه بـ‎edge/seo-core.js
// (ويستعملُه محوّلُ Cloudflare أيضاً). هنا نجلبُ القشرةَ ونرسلُ الردّ فقط.
import { renderSeo } from '../edge/seo-core.js';

const SITE = 'https://bazarastore.site';

export default async function handler(req, res) {
  const url = new URL(req.url, SITE);
  // القشرةُ المبنيّةُ كما هي على الحافّة — بلا قراءةِ ملفٍّ من القرص
  let shell;
  try {
    const r = await fetch(`${SITE}/index.html`, { headers: { 'x-bz-shell': '1' } });
    shell = await r.text();
  } catch {
    return res.status(302).setHeader('Location', url.pathname).end();
  }
  const out = await renderSeo(url.pathname, shell);
  res.status(out.status);
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  return res.send(out.body);
}
