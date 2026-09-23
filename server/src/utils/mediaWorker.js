// محرّكُ وسائطِ بازارا — معالجةُ الفيديو.
//
// ما كان كلاوديناري يفعلُه عند كلِّ تسليم (f_mp4,vc_h264) نفعلُه نحن مرّةً واحدةً عند الرفع:
// أصلُ الآيفون ‎.mov بترميز HEVC لا يشغّلُه كروم ولا أندرويد، فيُحوَّلُ إلى MP4/H.264 بدقّةِ
// ٧٢٠ (الضلعُ الأقصر) وثلاثين إطاراً، مع صورةِ غلاف. النتيجةُ ٥–١٠ ميغا بدلَ ٥٠–١٠٠،
// فتتّسعُ عشرةُ غيغا R2 لمئاتِ المنتجات. ثمّ يُحذَفُ الأصل.
//
// وفيديو الآيفون مصوَّرٌ HDR (HLG/Dolby Vision) منذ آيفون ١٢: تحويلُه إلى ٨ بتّ بلا مطابقةِ
// ألوانٍ يُخرجُه باهتاً رمادياً. نكشفُه من وصفِ الملفّ ونمرّرُه بـtonemap قبلَ التصغير.
//
// الطابورُ بقاعدةِ البيانات (media_jobs) لا بالذاكرة: إعادةُ تشغيلِ الخادمِ بمنتصفِ مهمّةٍ
// لا تُضيّعُها — resumePending() تلتقطُها عند الإقلاع. ومهمّةٌ واحدةٌ في كلِّ وقت: خادمُ
// Render صغير، ومهمّتانِ متوازيتانِ تُبطئانِ الاثنتين ولا تُسرّعانِ شيئاً.

import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import ffmpegPath from 'ffmpeg-static';
import { query } from '../config/db.js';
import { signedGet, putObject, deleteObject } from './r2.js';

export const videoKey = (id, name) => `v/${id}/${name}`;
const queue = [];
let busy = false;

/** يشغّلُ ffmpeg ويعيدُ stderr — مهلةٌ قصوى ١٥ دقيقة كي لا يعلقَ الطابورُ على ملفٍّ معطوب */
function ff(args, { allowFail = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ['-hide_banner', ...args]);
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (err.length > 200_000) err = err.slice(-100_000); });
    const t = setTimeout(() => p.kill('SIGKILL'), 15 * 60 * 1000);
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0 || allowFail) resolve(err);
      else reject(new Error(err.split('\n').filter(Boolean).slice(-3).join(' | ') || `ffmpeg ${code}`));
    });
  });
}

// الضلعُ الأقصرُ ٧٢٠ (لا العرض): الطوليُّ 1080×1920 ← 720×1280، والعريضُ 1920×1080 ← 1280×720.
// ولا تكبيرَ لما هو أصغرُ أصلاً.
const SCALE = "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'";
const TONEMAP = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';

// الترتيبُ يصنعُ الفرق: الإطاراتُ أوّلاً (٦٠ ← ٣٠) ثمّ التصغير، ثمّ مطابقةُ الألوانِ على ما بقي.
// مطابقةُ HDR بالفاصلةِ العائمةِ أغلى مرحلة؛ على دقّةٍ كاملةٍ وستّين إطاراً كانت ١٧ ثانيةً لمقطعِ
// أربعِ ثوانٍ، وبعدَ الإنقاصِ أوّلاً صارت جزءاً منها — وخادمُ Render أبطأُ من الحاسوبِ بكثير.
async function transcode(src, out, hdr, fps) {
  const pre = fps > 30.5 ? 'fps=30,' : '';
  // خيطٌ واحدٌ للفكِّ والفلترِ والترميز — ليس تفصيلاً: ffmpeg يفتحُ خيطاً لكلِّ نواةٍ يراها ولكلٍّ
  // ذاكرتُه، وخادمُ Render يُري عشراتِ أنويةِ المضيفِ مع أنّ حصّتَنا ٥١٢ ميغا. فيديو 1080p من
  // ١٤ ثانيةً قيسَ ٤٧٩ ميغا بستّ عشرةَ نواة ← انهارَ الخادمُ كلُّه (٢٣ أيلول)، وبخيطٍ واحدٍ ١٥٣.
  // والسرعةُ لا تخسرُ شيئاً هناك: حصّةُ المعالجِ أصلاً جزءٌ من نواة.
  const run = (vf) => ff(['-threads', '1', '-y', '-i', src, '-t', '180', '-vf', vf, '-fpsmax', '30',
    '-threads', '1', '-filter_threads', '1',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', out]);
  if (!hdr) return run(`${pre}${SCALE}`);
  try {
    return await run(`${pre}${SCALE},${TONEMAP}`);
  } catch (e) {
    // بعضُ نسخِ ffmpeg بلا zscale — ألوانٌ أبهتُ خيرٌ من فيديو لا يُعالَج
    if (!/zscale|tonemap/i.test(e.message)) throw e;
    console.warn('⚠️ معالجة فيديو: لا zscale، تحويلٌ بلا مطابقةِ ألوان');
    return run(`${pre}${SCALE}`);
  }
}

/** المعالجةُ المحلّيّةُ كلُّها (ملفٌّ ← ملفّان) — منفصلةٌ لتُختبَرَ بلا R2 ولا قاعدة */
export async function transcodeLocal(src, out, poster) {
  const probe = await ff(['-i', src], { allowFail: true });   // بلا مخرجٍ يطبعُ الوصفَ ويخرج
  const hdr = /arib-std-b67|smpte2084/.test(probe);
  const fps = Number((probe.match(/([\d.]+) fps/) || [])[1]) || 30;
  await transcode(src, out, hdr, fps);
  // الغلافُ من الناتجِ لا من الأصل: مدوَّرٌ ومطابَقُ الألوانِ كما سيُرى
  await ff(['-threads', '1', '-y', '-ss', '0.3', '-i', out, '-frames:v', '1', '-q:v', '4', poster]);
  return { hdr };
}

async function processJob({ id, src_key: srcKey }) {
  const tmp = (n) => path.join(os.tmpdir(), `bz-${id}-${n}`);
  const src = tmp('src'), out = tmp('720.mp4'), poster = tmp('poster.jpg');
  await query("UPDATE media_jobs SET status = 'processing', updated_at = now() WHERE id = $1", [id]);
  try {
    const res = await fetch(signedGet(srcKey));
    if (!res.ok) throw new Error(`تنزيل الأصل ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(src));

    const { hdr } = await transcodeLocal(src, out, poster);

    await putObject(videoKey(id, '720.mp4'), fs.readFileSync(out), 'video/mp4');
    await putObject(videoKey(id, 'poster.jpg'), fs.readFileSync(poster), 'image/jpeg');
    await deleteObject(srcKey).catch(() => {});
    await query("UPDATE media_jobs SET status = 'done', error = NULL, updated_at = now() WHERE id = $1", [id]);
    console.log(`✓ فيديو ${id} جاهز${hdr ? ' (HDR ← SDR)' : ''} — ${(fs.statSync(out).size / 1e6).toFixed(1)}MB`);
  } catch (e) {
    await query("UPDATE media_jobs SET status = 'error', error = $2, updated_at = now() WHERE id = $1", [id, String(e.message).slice(0, 300)]);
    console.error(`⚠️ فيديو ${id}:`, e.message);
  } finally {
    for (const f of [src, out, poster]) fs.rm(f, { force: true }, () => {});
  }
}

async function drain() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) await processJob(queue.shift());
  } finally {
    busy = false;
  }
}

/**
 * رسالةٌ صوتيّةٌ ← MP3: إنستغرام لا تقبلُ webm (تسجيلُ كروم)، فكان كلاوديناري يحوّلُها عند التسليم.
 * ثانيةٌ أو اثنتان لمقطعِ صوت — فتجري بالطلبِ نفسِه لا بالطابور (لا تنتظرُ خلفَ فيديو طويل).
 */
export async function audioToMp3(srcKey, outKey) {
  const id = crypto.randomBytes(8).toString('hex');
  const src = path.join(os.tmpdir(), `bz-a-${id}-src`), out = path.join(os.tmpdir(), `bz-a-${id}.mp3`);
  try {
    const res = await fetch(signedGet(srcKey));
    if (!res.ok) throw new Error(`تنزيل الصوت ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(src));
    await ff(['-y', '-i', src, '-vn', '-t', '300', '-c:a', 'libmp3lame', '-b:a', '96k', '-ac', '1', out]);
    await putObject(outKey, fs.readFileSync(out), 'audio/mpeg');
    await deleteObject(srcKey).catch(() => {});
  } finally {
    for (const f of [src, out]) fs.rm(f, { force: true }, () => {});
  }
}

/** يُسجِّلُ المهمّةَ ويبدؤُها. مكرّرُ الطلبِ لا يُكرّرُ المعالجة (المعرّفُ مفتاحٌ أساسيّ). */
export async function enqueueVideo(id, srcKey, userId) {
  const r = await query(
    `INSERT INTO media_jobs (id, src_key, user_id) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [id, srcKey, String(userId || '')]
  );
  if (r.rowCount) { queue.push({ id, src_key: srcKey }); drain(); }
}

export async function jobStatus(id) {
  const r = await query('SELECT status, error FROM media_jobs WHERE id = $1', [id]);
  return r.rows[0] || null;
}

/**
 * عند الإقلاع: ما انقطعَ بإعادةِ تشغيلٍ يُستأنَف — مرّةً واحدة.
 * مهمّةٌ «قيدَ المعالجة» عند الإقلاعِ إمّا قطعَها نشرٌ جديد، أو هي نفسُها أسقطَت الخادم (نفادُ ذاكرة).
 * والثانيةُ لو استُؤنفَت بلا حدٍّ لأسقطَته ثانيةً وثالثةً والموقعُ كلُّه واقف. فنَسِمُها بـ«resumed»
 * عند الاستئناف، ومن وُجدَت موسومةً وما زالت عالقةً فقد أسقطَته مرّتين: تُترَكُ خطأً.
 */
export async function resumePending() {
  await query(`UPDATE media_jobs SET status = 'error', error = 'أوقفَت الخادمَ مرّتين — لم تُستأنَف', updated_at = now()
               WHERE status = 'processing' AND error = 'resumed'`).catch(() => {});
  const r = await query(`UPDATE media_jobs SET error = 'resumed' WHERE status IN ('queued','processing')
                         RETURNING id, src_key, created_at`)
    .catch(() => ({ rows: [] }));
  if (!r.rows.length) return;
  r.rows.sort((a, b) => a.created_at - b.created_at);
  console.log(`↻ استئنافُ ${r.rows.length} فيديو قيدَ المعالجة`);
  queue.push(...r.rows);
  drain();
}
