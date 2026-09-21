// فحصُ دخانٍ على الإنتاجِ الحيّ:  npm run smoke:bot -- <slug>
//
// جاءَ من عطلٍ وقعَ فعلاً: أُضيفَ حقلانِ لنداءِ المزوّدِ فصارَ النداءُ يُرفَض،
// فسقطت البائعةُ لمحرّكِ القواعدِ المجّانيِّ **بصمت**. لا خطأَ بالصفحة، ولا رسالةَ
// للتاجرة، ولا اختبارَ يسقط — ١٨٦ حالةً كلُّها خضراءُ لأنّها تفحصُ الحرّاسَ
// والحساباتِ لا نداءَ المزوّد (ولا مفتاحَ محلّيّاً أصلاً). والزبائنُ يأخذونَ
// سردَ مخزونٍ جافّاً واحداً مهما سألوا.
//
// فالحيلةُ هنا لا تحتاجُ مفتاحاً ولا سرّاً: محرّكُ القواعدِ **حتميّ**، يعطي
// الجوابَ نفسَه لأسئلةٍ مختلفة. فإن سألنا ثلاثةَ أسئلةٍ متباعدةٍ وعادت بجوابٍ
// واحدٍ حرفاً بحرف، فالذكاءُ مطفأٌ مهما قالت الإعدادات.
//
// ولا يكتبُ شيئاً: مساعِدُ الموقعِ بلا حالةٍ ولا يمرُّ بصندوقِ التاجرة.
const BASE = process.env.SMOKE_BASE || 'https://bazarastore.site';
const slug = process.argv[2] || 'habooshstyle';

let ok = 0; let bad = 0;
const t = (n, c, x = '') => {
  if (c) { ok += 1; console.log('  ✓ ' + n); } else { bad += 1; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); }
};

// توكنُ CSRF يُطلَبُ من نطاقِ الموقعِ لا من نطاقِ Render مباشرةً: الكوكي يُكتَبُ
// للنطاقِ الذي طلبَه، وطلبٌ لـonrender يحملُ كوكيَّ نطاقٍ آخرَ فيُرفَض.
const r0 = await fetch(`${BASE}/api/csrf`, { headers: { origin: BASE } });
const setCookie = typeof r0.headers.getSetCookie === 'function' ? r0.headers.getSetCookie() : [r0.headers.get('set-cookie')];
const cookie = setCookie.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
const token = (await r0.json()).csrfToken;
if (!token) { console.log('✗ تعذّرَ توكنُ CSRF من ' + BASE); process.exit(1); }

const ask = async (content) => {
  const r = await fetch(`${BASE}/api/public/assistant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE, cookie, 'X-CSRF-Token': token },
    body: JSON.stringify({ store: slug, messages: [{ role: 'user', content }] }),
  });
  const j = await r.json().catch(() => ({}));
  return String(j.reply || j.error || '');
};

console.log('فحصُ دخانٍ حيٍّ · ' + BASE + ' · متجر ' + slug + '\n');

const asks = [
  'بدي فستان سهرة كحلي',
  'شو أرخص إشي عندكم؟',
  'التوصيل لطولكرم بكم وبوصل امتى؟',
];
const out = [];
for (const q of asks) out.push(await ask(q));
for (let i = 0; i < asks.length; i += 1) console.log('  «' + asks[i] + '»\n    → ' + out[i].replace(/\s+/g, ' ').slice(0, 110) + '\n');

t('البائعةُ تردُّ أصلاً', out.every((x) => x.length > 10), out.map((x) => x.length).join(','));
// الحارسُ الأهمّ: جوابٌ واحدٌ لثلاثةِ أسئلةٍ = محرّكُ القواعد = الذكاءُ ساقط
t('الذكاءُ يعملُ (لا جوابَ واحداً لكلِّ سؤال)', new Set(out).size === out.length,
  new Set(out).size === 1 ? 'ثلاثةُ أسئلةٍ وجوابٌ واحدٌ حرفيّاً ⇒ سقوطٌ صامتٌ لمحرّكِ القواعد' : 'تكرار');

// ولهجةٌ غريبةٌ تعني أنّ الوصفَ أو المصفاةَ لم تصلْ للإنتاج
const FOREIGN = ['شنو', 'دلوقتي', 'عايزة', 'إزاي', 'بتبغي', 'هسع', 'حسناً', 'بالطبع'];
const slip = FOREIGN.filter((w) => out.some((x) => x.includes(w)));
t('ولا كلمةَ من لهجةٍ أخرى', slip.length === 0, slip.join('، '));

console.log('\n' + '═'.repeat(58));
console.log(bad ? ('✗ ' + bad + ' فاشل من ' + (ok + bad)) : ('✓ ' + ok + '/' + ok + ' — الإنتاجُ سليم'));
process.exit(bad ? 1 : 0);
