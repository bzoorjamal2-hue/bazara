import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { r2Enabled, putObject, publicUrl } from './r2.js';
import { videoPoster } from './media.js';

// ───────── صورةٌ تقبلُها ميتا ─────────
//
// مرفقاتُ إنستغرام وماسنجر تجلبُها ميتا بنفسِها من رابطٍ عامّ، ولا تقبلُ WebP — وهي
// صيغةُ أغلبِ صورِ المنتجاتِ في محرّكِنا. فقبل أن نبعثَ صورةَ منتجٍ في محادثة:
//   • كلاوديناري: نطلبُ منه JPEG في الرابطِ نفسِه (f_jpg)؛
//   • محرّكُنا: نحوّلُ مقاسَ ‎960 مرّةً واحدةً إلى ‎960.jpg بجانبِه ونُبقيه — المفتاحُ لا
//     يتغيّرُ أبداً، فالمرّةُ الثانيةُ لنفسِ المنتجِ سؤالٌ واحدٌ بلا تحويل؛
//   • فيديو بلا صورة: غلافُه JPEG أصلاً.
const BZ_IMG = /^https?:\/\/.+?\/(i\/[a-f0-9]{32})\/(32|480|960|1600)\.(webp|jpg|png)$/;

function toJpeg(input) {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bzjpg-'));
    const src = path.join(dir, 'in.webp');
    const out = path.join(dir, 'out.jpg');
    fs.writeFileSync(src, input);
    const p = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-frames:v', '1', '-q:v', '3', out]);
    let err = '';
    const timer = setTimeout(() => p.kill('SIGKILL'), 20000);
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => {
      clearTimeout(timer);
      try {
        if (code === 0 && fs.existsSync(out)) resolve(fs.readFileSync(out));
        else reject(new Error(err.trim().slice(-200) || `ffmpeg ${code}`));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    p.on('error', (e) => { clearTimeout(timer); fs.rmSync(dir, { recursive: true, force: true }); reject(e); });
  });
}

export async function metaReadyImage(url) {
  const u = String(url || '');
  if (!u) return '';
  if (/\/video\/upload\//.test(u) || /\/v\/[a-f0-9]{32}\/720\.mp4$/.test(u)) return videoPoster(u, 1080);
  if (u.includes('res.cloudinary.com/') && u.includes('/upload/')) {
    return u.replace('/upload/', '/upload/f_jpg,q_auto,w_1080,c_limit/');
  }
  const m = BZ_IMG.exec(u);
  if (!m) return u;
  if (m[3] !== 'webp') return u; // jpg/png تقبلُها ميتا كما هي
  if (!r2Enabled()) return '';
  const key = `${m[1]}/960.jpg`;
  const out = publicUrl(key);
  const head = await fetch(out, { method: 'HEAD' }).catch(() => null);
  if (head?.ok) return out;
  const src = await fetch(u.replace(/\/(32|480|960|1600)\.webp$/, '/960.webp'));
  if (!src.ok) return '';
  const jpg = await toJpeg(Buffer.from(await src.arrayBuffer()));
  await putObject(key, jpg, 'image/jpeg');
  return out;
}

