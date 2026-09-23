// نقلُ الوسائطِ القديمةِ من كلاوديناري إلى محرّكِ بازارا (R2) وتحديثُ روابطِها بالقاعدة.
//
// الاستعمال — من مجلّد server، وملفُّ ‎.env‎ فيه مفاتيحُ R2 الخمسةُ نفسُها التي على Render:
//   node src/scripts/migrateCloudinary.mjs           تجريبيّ: الخطّةُ وفحصُ الوصولِ فقط — لا يكتبُ شيئاً
//   node src/scripts/migrateCloudinary.mjs --copy    ينقلُ الملفّاتِ إلى R2 ولا يلمسُ القاعدة
//   node src/scripts/migrateCloudinary.mjs --apply   ينقلُ ما بقي ثمّ يحدّثُ القاعدةَ بمعاملةٍ واحدة
//
// ثلاثُ ضماناتٍ لأنّ القاعدةَ المحلّيّةَ هي قاعدةُ الإنتاجِ نفسُها (Neon):
//   • يُستأنَف: كلُّ ملفٍّ يُنقَلُ يُسجَّلُ بـ‎.migrate/map.json‎ فورَه، فالانقطاعُ لا يُعيدُ ما تمّ.
//   • نسخةٌ احتياطيّةٌ كاملةٌ لكلِّ صفٍّ سيتغيّرُ (‎.migrate/backup-*.json‎) قبلَ أيِّ تعديل.
//   • معاملةٌ واحدة: التحديثُ ينجحُ كلُّه أو لا يتغيّرُ شيء. وما فشلَ نقلُه يبقى برابطِه القديم.
//
// النواتجُ بصيغةِ المحرّكِ نفسِها (انظر controllers/media.controller.js) كي تشتقَّ الواجهةُ مقاساتِها:
//   صورة ← i/<id>/{32,480,960,1600}.webp · فيديو ← v/<id>/720.mp4 + poster.jpg
//   صوت ← a/<id>/voice.mp3 · ملفُّ raw (مرفقاتُ إنستغرام) ← m/ig/<id>.<ext>

import 'dotenv/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import ffmpegPath from 'ffmpeg-static';
import { r2Enabled, putObject, publicUrl } from '../utils/r2.js';
import { transcodeLocal } from '../utils/mediaWorker.js';

const run = promisify(execFile);
const COPY = process.argv.includes('--copy') || process.argv.includes('--apply');
const APPLY = process.argv.includes('--apply');
const CLD = 'https://res.cloudinary.com/dkzrnu4cs';
const WORK = path.resolve('.migrate');
const MAP_FILE = path.join(WORK, 'map.json');
fs.mkdirSync(WORK, { recursive: true });

// الفاصلةُ جزءٌ من روابطِ كلاوديناري (f_mp4,vc_h264,…) — الحدُّ علامةُ اقتباسٍ أو مسافةٌ أو قوس
const URL_RE = /https:\/\/res\.cloudinary\.com\/dkzrnu4cs\/[a-z]+\/upload\/[^\s"'\\}\]]+/g;
const CAST = { text: 'text', varchar: 'varchar', json: 'json', jsonb: 'jsonb', _text: 'text[]', _varchar: 'varchar[]' };

/** مفتاحُ الملفِّ الأصليّ: النوعُ + ‎v<إصدار>/<معرّف>‎ بلا امتدادٍ ولا تحويلات — روابطُ كثيرةٌ تشيرُ لملفٍّ واحد */
function parse(url) {
  const m = url.match(/\/(image|video|raw)\/upload\/(?:.*?\/)?(v\d+\/[^?]+?)(?:\.([a-z0-9]+))?(?:\?.*)?$/i);
  if (!m) return null;
  const [, type, vpart, extRaw] = m;
  const ext = (extRaw || '').toLowerCase();
  let variant = type;
  if (type === 'video') {
    if (/^(jpe?g|png|webp)$/.test(ext)) variant = 'poster';
    else if (/^(mp3|m4a|aac|wav|ogg)$/.test(ext) || /\/f_mp3\//.test(url)) variant = 'audio';
  }
  return { key: `${type}/${vpart}`, type, vpart, ext, variant };
}

const loadMap = () => (fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {});
const saveMap = (m) => fs.writeFileSync(MAP_FILE, JSON.stringify(m, null, 1));
const newId = () => crypto.randomBytes(16).toString('hex');
const tmp = (n) => path.join(WORK, `tmp-${n}`);

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`تنزيل ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return { type: String(res.headers.get('content-type') || '').split(';')[0].trim(), size: buf.length };
}

/** صورة ← أربعةُ مقاساتِ WebP كما يصنعُها المتصفّحُ عند الرفع. f_png من كلاوديناري: بلا فقد،
 *  ومدوَّرةٌ حسبَ EXIF، وتحفظُ الشفافيّة (الشعارات) */
async function migrateImage(srcUrl) {
  const id = newId(), src = tmp(`${id}.png`);
  await download(srcUrl, src);
  const probe = (await run(ffmpegPath, ['-hide_banner', '-i', src]).catch((e) => e)).stderr || '';
  const alpha = /rgba|yuva|ya8|argb|bgra|pal8/.test(probe);
  for (const w of [32, 480, 960, 1600]) {
    const out = tmp(`${id}-${w}.webp`);
    await run(ffmpegPath, ['-hide_banner', '-v', 'error', '-y', '-i', src,
      '-vf', `scale='min(${w},iw)':-1:flags=lanczos`, '-c:v', 'libwebp', '-quality', w === 32 ? '50' : '82',
      ...(alpha ? ['-pix_fmt', 'yuva420p'] : []), out]);
    await putObject(`i/${id}/${w}.webp`, fs.readFileSync(out), 'image/webp');
    fs.rmSync(out, { force: true });
  }
  fs.rmSync(src, { force: true });
  return { image: publicUrl(`i/${id}/1600.webp`) };
}

async function migrateVideo(vpart) {
  const id = newId(), src = tmp(`${id}.mp4`), out = tmp(`${id}-720.mp4`), poster = tmp(`${id}-poster.jpg`);
  try {
    // المصدرُ بدقّةٍ أعلى ممّا سنُخرج (١٢٨٠) وجودةٍ جيّدة — لا الأصلُ كاملاً: يكفي وينزلُ أخفّ
    await download(`${CLD}/video/upload/f_mp4,vc_h264,q_auto:good,w_1280,c_limit/${vpart}.mp4`, src);
    await transcodeLocal(src, out, poster);
    await putObject(`v/${id}/720.mp4`, fs.readFileSync(out), 'video/mp4');
    await putObject(`v/${id}/poster.jpg`, fs.readFileSync(poster), 'image/jpeg');
    return { video: publicUrl(`v/${id}/720.mp4`), poster: publicUrl(`v/${id}/poster.jpg`) };
  } finally {
    for (const f of [src, out, poster]) fs.rmSync(f, { force: true });
  }
}

async function migrateAudio(vpart) {
  const id = newId(), src = tmp(`${id}.mp3`);
  try {
    await download(`${CLD}/video/upload/f_mp3/${vpart}.mp3`, src);
    await putObject(`a/${id}/voice.mp3`, fs.readFileSync(src), 'audio/mpeg');
    return { audio: publicUrl(`a/${id}/voice.mp3`) };
  } finally { fs.rmSync(src, { force: true }); }
}

const RAW_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'application/pdf': 'pdf' };
/** النوعُ من أوّلِ البايتاتِ نفسِها: ملفّاتُ raw (ريلزُ إنستغرام المنسوخةُ بلا امتداد — ١٤ منها) يُسلِّمُها
 *  كلاوديناري بنوعٍ عامّ (octet-stream)، فلو نُسخت كما هي لصارت ‎.bin‎ ورفضَ المتصفّحُ تشغيلَها */
function sniff(file) {
  const b = fs.readFileSync(file).subarray(0, 16);
  const s = (i, n) => b.toString('latin1', i, i + n);
  if (s(4, 4) === 'ftyp') return 'video/mp4';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (s(1, 3) === 'PNG') return 'image/png';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'image/webp';
  if (s(0, 3) === 'GIF') return 'image/gif';
  if (s(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  return '';
}

async function migrateRaw(anyUrl) {
  const id = newId(), src = tmp(`${id}.raw`);
  try {
    const got = await download(anyUrl, src);
    const type = RAW_EXT[got.type] ? got.type : (sniff(src) || got.type);
    const ext = RAW_EXT[type] || 'bin';
    await putObject(`m/ig/${id}.${ext}`, fs.readFileSync(src), type || 'application/octet-stream');
    return { raw: publicUrl(`m/ig/${id}.${ext}`) };
  } finally { fs.rmSync(src, { force: true }); }
}

/** الرابطُ الجديدُ لكلِّ رابطٍ قديمٍ بحسبِ ما كان يطلبُه: فيديو ← mp4، ولقطتُه ← الغلاف */
function newUrlFor(p, done) {
  if (!done) return null;
  if (p.variant === 'poster') return done.poster || done.image || null;
  if (p.variant === 'video') return done.video || null;
  if (p.variant === 'audio') return done.audio || null;
  if (p.variant === 'raw') return done.raw || null;
  return done.image || null;
}

/* ══════════ ١ — جردُ القاعدة ══════════ */
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const cols = (await db.query(`SELECT table_name, column_name, udt_name FROM information_schema.columns
  WHERE table_schema = 'public' AND udt_name = ANY($1)`, [Object.keys(CAST)])).rows;
const places = [];            // { t, col, udt }
const urls = new Set();
for (const { table_name: t, column_name: col, udt_name: udt } of cols) {
  const r = await db.query(`SELECT "${col}"::text AS v FROM "${t}" WHERE "${col}"::text LIKE '%res.cloudinary.com%'`);
  if (!r.rowCount) continue;
  places.push({ t, col, udt });
  r.rows.forEach((x) => (x.v.match(URL_RE) || []).forEach((u) => urls.add(u)));
}
const assets = new Map();     // key → { type, vpart, variants:Set, sample }
const unparsed = [];
for (const u of urls) {
  const p = parse(u);
  if (!p) { unparsed.push(u); continue; }
  const a = assets.get(p.key) || { type: p.type, vpart: p.vpart, variants: new Set(), sample: u };
  a.variants.add(p.variant);
  assets.set(p.key, a);
}
const kindOf = (a) => (a.type === 'raw' ? 'raw' : a.variants.has('video') ? 'video'
  : a.variants.has('audio') ? 'audio' : a.type === 'video' ? 'posterOnly' : 'image');

const map = loadMap();
const todo = [...assets.entries()].filter(([k]) => !map[k]?.done);
const tally = {};
for (const a of assets.values()) tally[kindOf(a)] = (tally[kindOf(a)] || 0) + 1;
console.log(`الجرد: ${urls.size} رابط بـ${places.length} عموداً ← ${assets.size} ملف أصلي`, JSON.stringify(tally));
console.log(`منقولٌ سابقاً: ${assets.size - todo.length} · باقٍ: ${todo.length}${unparsed.length ? ` · غيرُ مفهوم: ${unparsed.length}` : ''}`);

if (!r2Enabled()) {
  console.log('\n✗ مفاتيحُ R2 ناقصةٌ بـserver/.env — أضِف الخمسةَ نفسَها التي على Render ثمّ أعِد.');
  await db.end(); process.exit(1);
}
// هل رجعَ كلاوديناري؟ بلا وصولٍ لا معنى للنقل
const probeRes = await fetch([...assets.values()][0]?.sample || `${CLD}/image/upload/sample.jpg`, { method: 'HEAD' });
console.log(`وصولُ كلاوديناري: ${probeRes.status}${probeRes.status === 401 ? ' — ما زال معطّلاً؛ لا نقلَ قبلَ أن يُعيدوا تفعيلَه' : ' ✓'}`);
if (!COPY) { console.log('\n(تجريبيّ — لا شيءَ نُقِل. للنقل: ‎--copy‎ ، وللنقلِ والتحديث: ‎--apply‎)'); await db.end(); process.exit(0); }
if (probeRes.status === 401) { await db.end(); process.exit(1); }

/* ══════════ ٢ — النقل (يُستأنَف) ══════════ */
let n = 0;
for (const [key, a] of todo) {
  n++;
  const kind = kindOf(a);
  const t0 = Date.now();
  try {
    const done = kind === 'video' ? await migrateVideo(a.vpart)
      : kind === 'audio' ? await migrateAudio(a.vpart)
      : kind === 'raw' ? await migrateRaw(a.sample.replace(/\/raw\/upload\/.*?(v\d+\/)/, '/raw/upload/$1'))
      : kind === 'posterOnly' ? await migrateImage(`${CLD}/video/upload/so_0,f_png/${a.vpart}.png`)
      : await migrateImage(`${CLD}/image/upload/f_png/${a.vpart}.png`);
    map[key] = { kind, done: true, ...done };
    console.log(`✓ [${n}/${todo.length}] ${kind} ${key} (${((Date.now() - t0) / 1000).toFixed(1)}ث)`);
  } catch (e) {
    map[key] = { kind, done: false, error: String(e.message).slice(0, 200) };
    console.log(`✗ [${n}/${todo.length}] ${kind} ${key}: ${e.message}`);
  }
  saveMap(map);
}
const failed = Object.entries(map).filter(([, v]) => !v.done);
console.log(`\nالنقل: ${assets.size - failed.length}/${assets.size} ✓${failed.length ? ` · فشل ${failed.length} (يبقى برابطِه القديم — أعِد التشغيلَ لمحاولتِه ثانيةً)` : ''}`);
if (!APPLY) { await db.end(); process.exit(0); }

/* ══════════ ٣ — تحديثُ القاعدة: نسخةٌ احتياطيّة، ثمّ معاملةٌ واحدة ══════════ */
const pairs = [];
for (const u of urls) {
  const p = parse(u);
  const nu = p && newUrlFor(p, map[p.key]);
  if (nu) pairs.push([u, nu]);
}
// الأطولُ أوّلاً: لو استُبدلَ رابطٌ قصيرٌ يقعُ داخلَ أطولَ منه لفسدَ الأطول
pairs.sort((x, y) => y[0].length - x[0].length);

const backup = {};
for (const { t, col } of places) {
  const r = await db.query(`SELECT to_jsonb(x.*) AS row FROM "${t}" x WHERE x."${col}"::text LIKE '%res.cloudinary.com%'`);
  (backup[`${t}.${col}`] = r.rows.map((z) => z.row));
}
const bfile = path.join(WORK, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bfile, JSON.stringify(backup));
console.log(`نسخةٌ احتياطيّة: ${bfile}`);

try {
  await db.query('BEGIN');
  let changed = 0;
  for (const { t, col, udt } of places) {
    for (const [oldU, newU] of pairs) {
      const r = await db.query(
        `UPDATE "${t}" SET "${col}" = replace("${col}"::text, $1, $2)::${CAST[udt]} WHERE "${col}"::text LIKE '%' || $1 || '%'`,
        [oldU, newU]);
      changed += r.rowCount;
    }
  }
  let left = 0;
  for (const { t, col } of places) {
    left += (await db.query(`SELECT COUNT(*)::int AS c FROM "${t}" WHERE "${col}"::text LIKE '%res.cloudinary.com%'`)).rows[0].c;
  }
  await db.query('COMMIT');
  console.log(`✓ القاعدة: ${changed} تعديلاً بـ${pairs.length} رابطاً · صفوفٌ ما زالت على كلاوديناري: ${left}`);
} catch (e) {
  await db.query('ROLLBACK');
  console.log(`✗ تراجعٌ كامل — القاعدةُ لم تتغيّر: ${e.message}`);
  process.exitCode = 1;
}
await db.end();
process.exit();
