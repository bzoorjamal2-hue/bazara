// محوّلُ Vercel لخريطةِ الموقع — المنطقُ بـ‎edge/sitemap-core.js (ويستعملُه Cloudflare أيضاً).
import { renderSitemap, SITE } from '../edge/sitemap-core.js';

export default async function handler(req, res) {
  const out = await renderSitemap(() => fetch(`${SITE}/sitemap-build.xml`));
  res.status(out.status);
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  return res.send(out.body);
}
