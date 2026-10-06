import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';

// ───────── طباعةُ الفواتيرِ من داخلِ التطبيق ─────────
//
// تطبيقُ الجوّال (Capacitor) يعرضُ الموقعَ داخلَ WebView، وwindow.print() هناك لا يفعلُ
// شيئاً — لا على آيفون ولا على أندرويد. فكانت «طباعة» تُكبَسُ ولا يحدثُ شيء.
//
// الحلّ: الواجهةُ ترفعُ الفواتيرَ الجاهزةَ (HTML وأنماطُه) هنا فتأخذُ رابطاً مؤقّتاً على
// نطاقِ الخادم. ولأنّ نطاقَه غيرُ نطاقِ التطبيق، يفتحُه التطبيقُ بمتصفّحِ الجوّالِ نفسِه
// (سفاري أو كروم) — وهناك تعملُ الطباعةُ وحفظُ PDF كما في أيِّ متصفّح، والصفحةُ تفتحُ
// حوارَ الطباعةِ وحدَها.
//
// الرابطُ عشوائيٌّ (١٢٨ بت) ويعيشُ ربعَ ساعة بذاكرةِ الخادمِ فقط — فيه أسماءُ زبائنَ
// وأرقامُهم، فلا يُحفَظُ بقاعدةٍ ولا يبقى. والصفحةُ بسياسةِ محتوى تمنعُ أيَّ سكربتٍ غيرَ
// سطرِ الطباعةِ نفسِه، فلا يصيرُ نصٌّ مرفوعٌ صفحةً تُشغِّلُ شيئاً.

const TTL = 15 * 60 * 1000;
const MAX_HTML = 3 * 1024 * 1024;
const MAX_JOBS = 300;
const jobs = new Map(); // token → { html, css, title, dir, at }

function sweep() {
  const now = Date.now();
  for (const [k, v] of jobs) if (now - v.at > TTL) jobs.delete(k);
  while (jobs.size > MAX_JOBS) jobs.delete(jobs.keys().next().value);
}

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const createLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `pj:${req.user?.id || req.ip}`,
  message: { error: 'طباعات كثيرة. جرّبي بعد شوي.' },
});

const router = Router();

// POST /api/print-jobs — { html, css, title, dir } → { url }
router.post('/print-jobs', requireAuth, createLimiter, (req, res) => {
  const html = String(req.body?.html || '');
  const css = String(req.body?.css || '');
  if (!html) return res.status(400).json({ error: 'ما في إشي للطباعة.' });
  if (html.length + css.length > MAX_HTML) return res.status(413).json({ error: 'الفواتير كتير — اطبعي عدد أقل مرّة وحدة.' });
  sweep();
  const token = crypto.randomBytes(16).toString('hex');
  jobs.set(token, {
    html,
    css,
    title: String(req.body?.title || 'Bazara').slice(0, 120),
    dir: req.body?.dir === 'ltr' ? 'ltr' : 'rtl',
    at: Date.now(),
  });
  const base = (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.json({ url: `${base}/api/print/${token}` });
});

// GET /api/print/:token — صفحةُ الطباعة (تُفتَحُ بمتصفّحِ الجوّال)
router.get('/print/:token', (req, res) => {
  sweep();
  const job = jobs.get(String(req.params.token || ''));
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex');
  if (!job) {
    res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Tahoma,sans-serif;text-align:center;padding:60px 20px;color:#444" dir="rtl"><h2>انتهت صلاحية رابط الطباعة</h2><p>ارجعي للتطبيق واكبسي «طباعة» من جديد.</p></body>');
    return;
  }
  const nonce = crypto.randomBytes(12).toString('base64');
  res.set('Content-Security-Policy', [
    "default-src 'none'",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    'img-src https: data:',
    `script-src 'nonce-${nonce}'`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; '));
  res.type('html').send(`<!doctype html>
<html lang="ar" dir="${job.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(job.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap">
<style>${job.css.replace(/<\/style/gi, '<\\/style')}</style>
<style>
  .bz-pbar{position:sticky;top:0;z-index:9;display:flex;gap:8px;align-items:center;justify-content:center;padding:10px;background:#1F1E1D;font-family:Tajawal,Tahoma,sans-serif}
  .bz-pbar button{font:800 15px Tajawal,Tahoma,sans-serif;border:0;border-radius:12px;padding:10px 22px;background:#fff;color:#1F1E1D;cursor:pointer}
  .bz-pbar span{color:#d6d2cb;font:600 12px Tajawal,Tahoma,sans-serif}
  @media print{.bz-pbar{display:none!important}}
</style>
</head>
<body>
<div class="bz-pbar"><button id="bz-print" type="button">🖨️ اطبعي</button><span>أو احفظيها PDF من نفس الشاشة</span></div>
${job.html}
<script nonce="${nonce}">
  document.getElementById('bz-print').addEventListener('click', function () { window.print(); });
  // الخطُّ أوّلاً ثمّ الحوار — وإلّا تُطبَعُ أوّلُ ورقةٍ بخطِّ النظامِ الاحتياطيّ
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
    setTimeout(function () { window.print(); }, 350);
  });
</script>
</body>
</html>`);
});

export default router;
