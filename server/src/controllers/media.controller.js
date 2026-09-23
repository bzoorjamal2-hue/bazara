// محرّكُ وسائطِ بازارا — المدخل: روابطُ رفعٍ موقّعةٌ مسبقاً، وتشغيلُ معالجةِ الفيديو.
//
// المتصفّحُ يُحضِّرُ الملفّاتِ بنفسِه (الصورُ تُصغَّرُ عنده لأربعةِ مقاساتٍ قبلَ الرفع)، ثمّ
// يطلبُ من هنا رابطاً لكلِّ ملفٍّ ويرفعُ إلى R2 مباشرة. خادمُنا لا يلمسُ البايتات.
//
// الأسماءُ ثابتةٌ لا يختارُها المرسِل، والحجمُ داخلٌ في التوقيع — فالرابطُ لا يصلحُ إلّا لملفٍّ
// بذلك الاسمِ وذلك الحجمِ بالضبط. هكذا لا يصيرُ المسارُ باباً لتخزينِ ما نشاءُ على حسابِنا.
//
// صيغةُ الروابطِ عقدٌ مع الواجهة (client/src/utils/cloudinary.js تشتقُّ منها المقاسات):
//   صورة: <base>/i/<id>/{32,480,960,1600}.{webp|jpg|png} — المخزَّنُ بالقاعدةِ ‎1600
//   فيديو: <base>/v/<id>/720.mp4 + ‎poster.jpg — والأصلُ src.* يُحذَفُ بعد المعالجة

import crypto from 'crypto';
import { r2Enabled, presign, publicUrl } from '../utils/r2.js';
import { enqueueVideo, jobStatus, videoKey, audioToMp3 } from '../utils/mediaWorker.js';

const MB = 1024 * 1024;
const IMG_NAME = /^(32|480|960|1600)\.(webp|jpg|png)$/;
const VID_SRC = /^src\.(mov|mp4|m4v|webm|3gp)$/;
const AUD_SRC = /^src\.(webm|m4a|mp4|ogg|aac|wav)$/;   // رسائلُ إنستغرام الصوتيّة (تسجيلُ المتصفّح)
const TYPES = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', mov: 'video/quicktime', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', '3gp': 'video/3gpp',
  m4a: 'audio/mp4', ogg: 'audio/ogg', aac: 'audio/aac', wav: 'audio/wav' };
const ID = /^[a-f0-9]{32}$/;

// الحدود: مقاساتُ الصورةِ مصغَّرةٌ بالمتصفّحِ أصلاً فأربعةُ ميغا سقفٌ واسع؛ والفيديو الأصليُّ
// من الآيفون قد يبلغُ مئاتِ الميغا لدقيقةٍ بـ4K — وهو يُحذَفُ بعد التحويلِ على كلِّ حال.
const LIMIT = { image: 4 * MB, src: 400 * MB, poster: 3 * MB, audio: 20 * MB };

export async function presignUpload(req, res) {
  if (!r2Enabled()) return res.status(503).json({ error: 'media_engine_off' });
  const kind = ['video', 'audio'].includes(req.body?.kind) ? req.body.kind : 'image';
  const parts = Array.isArray(req.body?.parts) ? req.body.parts.slice(0, 5) : [];
  // الفيديو والصوتُ للتاجراتِ وحدَهنّ؛ الصورةُ تُرفَعُ بلا حسابٍ أيضاً (صورُ تقييماتِ الزبونات)
  if (kind !== 'image' && !req.user) return res.status(401).json({ error: 'يجب تسجيل الدخول.' });
  if (!parts.length) return res.status(400).json({ error: 'لا ملفات.' });

  const id = crypto.randomBytes(16).toString('hex');
  const prefix = `${kind[0]}/${id}`;               // i/ · v/ · a/
  const put = {};
  for (const p of parts) {
    const name = String(p?.name || '');
    const size = Math.floor(Number(p?.size));
    const ok = kind === 'image' ? IMG_NAME.test(name) && size <= LIMIT.image
      : kind === 'audio' ? AUD_SRC.test(name) && size <= LIMIT.audio
      : (VID_SRC.test(name) && size <= LIMIT.src) || (name === 'poster.jpg' && size <= LIMIT.poster);
    if (!ok || !(size > 0)) {
      return res.status(400).json({ error: size > LIMIT.src ? 'حجم الملف كبير جداً (الحدّ ٤٠٠ ميغا).' : 'ملف غير مقبول.' });
    }
    const type = TYPES[name.split('.').pop()] || 'image/jpeg';
    put[name] = { url: presign('PUT', `${prefix}/${name}`, { headers: { 'content-length': size, 'content-type': type } }), type };
  }
  res.json({ id, base: publicUrl(prefix), put });
}

/** بعدَ رفعِ الأصل: يُسجَّلُ الفيديو للمعالجةِ ويُعادُ رابطُه النهائيّ فوراً (يجهزُ خلالَ دقائق) */
export async function processVideo(req, res) {
  if (!r2Enabled()) return res.status(503).json({ error: 'media_engine_off' });
  const id = String(req.params.id || '');
  const src = String(req.body?.src || '');
  if (!ID.test(id) || !VID_SRC.test(src)) return res.status(400).json({ error: 'طلب غير صالح.' });
  await enqueueVideo(id, videoKey(id, src), req.user.id);
  res.json({ url: publicUrl(videoKey(id, '720.mp4')), poster: publicUrl(videoKey(id, 'poster.jpg')) });
}

/** رسالةٌ صوتيّة: تُحوَّلُ MP3 بالطلبِ نفسِه (ثوانٍ) ويُعادُ رابطُها جاهزاً */
export async function processAudio(req, res) {
  if (!r2Enabled()) return res.status(503).json({ error: 'media_engine_off' });
  const id = String(req.params.id || '');
  const src = String(req.body?.src || '');
  if (!ID.test(id) || !AUD_SRC.test(src)) return res.status(400).json({ error: 'طلب غير صالح.' });
  const out = `a/${id}/voice.mp3`;
  await audioToMp3(`a/${id}/${src}`, out);
  res.json({ url: publicUrl(out) });
}

export async function videoStatus(req, res) {
  const id = String(req.params.id || '');
  if (!ID.test(id)) return res.status(400).json({ error: 'طلب غير صالح.' });
  const job = await jobStatus(id);
  res.json(job || { status: 'unknown' });
}
