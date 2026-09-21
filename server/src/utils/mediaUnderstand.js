// فهمُ الصورةِ والرسالةِ الصوتيّة.
//
// بسوقِنا نصفُ ما يصلُ الدايركت ليس نصّاً: زبونةٌ تُرسِلُ صورةَ فستانٍ رأتْه و«بدّي
// شي زي هيك»، وأخرى تُسجّلُ صوتاً لأنّها تمشي. وكانت البائعةُ تتجاهلُهما تماماً —
// لا ترى ولا تسمع، فتبدو كمن أدارَ ظهرَه.
//
// **نقرأُ من رابطِ Meta الأصليِّ لا من نسختِنا على كلاوديناري.** الرابطُ ما زالَ
// طازجاً لحظةَ وصولِ الحدث، وقراءتُه مجّانيّةٌ علينا — بينما جلبُ نسختِنا يُحسَبُ
// من حصّةِ التسليمِ المحدودةِ التي عطّلت الحسابَ مرّةً وأخفت صورَ الموقعِ كلَّها.

const MAX_BYTES = 4 * 1024 * 1024; // ما فوقَها لا يُرسَلُ لنموذج

async function fetchMedia(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`media ${r.status}`);
    const type = (r.headers.get('content-type') || '').split(';')[0].trim();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('media too large');
    return { base64: buf.toString('base64'), mime: type, bytes: buf.length };
  } finally { clearTimeout(timer); }
}

// ───────────────────── الصورة ─────────────────────

// نُرجِعُ كتلةَ صورةٍ جاهزةً لرسالةِ Claude، أو inline_data لجيميني. الاختلافُ بينهما
// شكليٌّ فقط، والمنطقُ واحد.
export async function imageBlock(url) {
  const m = await fetchMedia(url);
  const mime = /^image\/(jpeg|png|webp|gif)$/.test(m.mime) ? m.mime : 'image/jpeg';
  return { base64: m.base64, mime, bytes: m.bytes };
}

// ───────────────────── الصوت ─────────────────────

// التفريغُ الصوتيُّ عندَ جيميني وحدَه من مزوّدَينا — Claude لا يسمع. فإن لم يكن
// مفتاحُ جيميني موجوداً نعودُ بفراغٍ، وتقولُ البائعةُ للزبونةِ بصراحةٍ إنّها لم
// تستطعْ سماعَها وتطلبُ منها الكتابة — خيرٌ من صمتٍ يبدو تجاهلاً.
export function canHear() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function transcribe(url) {
  if (!canHear()) return '';
  const m = await fetchMedia(url);
  // إنستغرام تُرسِلُ الصوتَ ‎mp4/m4a غالباً، وأحياناً ogg
  const mime = /^audio\//.test(m.mime) ? m.mime : 'audio/mp4';
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: mime, data: m.base64 } },
            {
              text: 'فرّغ هذا التسجيل الصوتي إلى نصّ عربيّ كما قيل حرفيّاً، بلهجته المحكيّة كما هي.'
                + ' لا تترجم ولا تلخّص ولا تُضِف شيئاً. إن لم تسمع كلاماً مفهوماً فأعِد نصّاً فارغاً.',
            },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 400 },
      }),
    });
    if (!r.ok) throw new Error(`gemini audio ${r.status}`);
    const data = await r.json();
    const txt = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(' ') || '';
    return txt.trim().slice(0, 600);
  } finally { clearTimeout(timer); }
}
