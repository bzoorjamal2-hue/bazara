// اختباراتُ منطقِ صندوقِ الرسائل. تُشغَّل: node client/src/utils/chat.test.mjs
// بلا إطارِ اختبارٍ ولا تبعيّة: ملفٌّ واحدٌ يعمل بـNode وحدَه، فلا عذرَ لتركِه.
import assert from 'node:assert/strict';
import { buildItems, guessKind, normalizeAr, findMobile, cldAudioMp3, sameDay } from './chat.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('✓ ' + name); }
  catch (e) { console.error('✗ ' + name + '\n  ' + e.message); process.exitCode = 1; }
}

const at = (iso) => new Date(iso).toISOString();

test('فاصلُ اليومِ يُوضَعُ مرّةً لكلِّ يوم', () => {
  const items = buildItems([
    { id: '1', direction: 'in', text: 'a', created_at: at('2026-09-06T10:00:00Z') },
    { id: '2', direction: 'in', text: 'b', created_at: at('2026-09-06T10:01:00Z') },
    { id: '3', direction: 'in', text: 'c', created_at: at('2026-09-07T10:00:00Z') },
  ]);
  assert.equal(items.filter((x) => x.type === 'day').length, 2);
});

test('الدفقةُ تجمعُ المتتاليةَ من الطرفِ نفسِه خلالَ أربعِ دقائق', () => {
  const items = buildItems([
    { id: '1', direction: 'in', created_at: at('2026-09-06T10:00:00Z') },
    { id: '2', direction: 'in', created_at: at('2026-09-06T10:01:00Z') },
    { id: '3', direction: 'in', created_at: at('2026-09-06T10:30:00Z') },
  ]).filter((x) => x.type === 'msg');
  assert.equal(items[0].last, false, 'الأولى ليست آخرَ دفقتِها');
  assert.equal(items[1].last, true, 'الثانيةُ تختمُ الدفقة');
  assert.equal(items[2].first, true, 'الثالثةُ تبدأُ دفقةً جديدة (نصفُ ساعة)');
});

test('اختلافُ الاتّجاهِ يكسرُ الدفقةَ ولو تقاربَ الوقت', () => {
  const items = buildItems([
    { id: '1', direction: 'in', created_at: at('2026-09-06T10:00:00Z') },
    { id: '2', direction: 'out', created_at: at('2026-09-06T10:00:30Z') },
  ]).filter((x) => x.type === 'msg');
  assert.equal(items[0].last, true);
  assert.equal(items[1].first, true);
});

test('محادثةٌ فارغةٌ لا تُنتجُ عناصر', () => {
  assert.deepEqual(buildItems([]), []);
});

test('نوعُ المرفقِ يُستنتَجُ من الامتداد', () => {
  assert.equal(guessKind('https://x/y/a.JPG'), 'image');
  assert.equal(guessKind('https://x/y/a.mp4?token=1'), 'video');
  assert.equal(guessKind('https://x/y/a.m4a'), 'audio');
  assert.equal(guessKind('https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=9'), '');
});

test('تطبيعُ العربيّةِ يوحّدُ الهمزةَ والتاءَ والياء', () => {
  assert.equal(normalizeAr('عبايَة'), normalizeAr('عبايه'));
  assert.equal(normalizeAr('إسم'), normalizeAr('اسم'));
  assert.equal(normalizeAr('مصطفى'), normalizeAr('مصطفي'));
  assert.equal(normalizeAr('  فستان   صيفي '), 'فستان صيفي');
});

test('رقمُ الجوّالِ يُلتقَطُ بكلِّ صيغةٍ يكتبُها الناس', () => {
  assert.equal(findMobile('رقمي 0592124988 تواصل معي'), '0592124988');
  assert.equal(findMobile('0592-124-988'), '0592124988');
  assert.equal(findMobile('+970 59 212 4988'), '0592124988');
  assert.equal(findMobile('00970592124988'), '0592124988');
  assert.equal(findMobile('ما في رقم هنا'), '');
  assert.equal(findMobile(''), '');
});

test('الصوتُ يُطلَبُ mp3 من Cloudinary مهما كانت صيغةُ التسجيل', () => {
  const webm = 'https://res.cloudinary.com/dkzrnu4cs/video/upload/v1/ig/voice.webm';
  assert.equal(cldAudioMp3(webm), 'https://res.cloudinary.com/dkzrnu4cs/video/upload/f_mp3/v1/ig/voice.mp3');
  assert.equal(cldAudioMp3('https://other.host/a.webm'), 'https://other.host/a.webm', 'رابطٌ ليس لكلاوديناري يُترَكُ كما هو');
});

test('sameDay يفرّقُ بين يومين متتاليين', () => {
  assert.equal(sameDay(new Date('2026-09-06T23:59:00'), new Date('2026-09-07T00:01:00')), false);
  assert.equal(sameDay(new Date('2026-09-06T00:01:00'), new Date('2026-09-06T23:59:00')), true);
});


// ───────── حالاتٌ حدّيّةٌ أضيفت بعد المراجعةِ الثانية ─────────

test('منتصفُ الليلِ يكسرُ الدفقةَ ولو كان الفارقُ دقيقتين', () => {
  const items = buildItems([
    { id: '1', direction: 'in', created_at: at('2026-09-06T20:59:00Z') },
    { id: '2', direction: 'in', created_at: at('2026-09-06T21:01:00Z') },
  ]).filter((x) => x.type === 'msg');
  // بتوقيتٍ محلّيٍّ +٣ هذان يومان مختلفان (23:59 ثمّ 00:01)
  const days = buildItems([
    { id: '1', direction: 'in', created_at: at('2026-09-06T20:59:00Z') },
    { id: '2', direction: 'in', created_at: at('2026-09-06T21:01:00Z') },
  ]).filter((x) => x.type === 'day');
  if (days.length === 2) {
    assert.equal(items[0].last, true, 'اليومُ الجديدُ يبدأُ دفقةً جديدة');
    assert.equal(items[1].first, true);
  } else {
    assert.equal(days.length, 1, 'أو هما في يومٍ واحدٍ بحسب المنطقة الزمنيّة');
  }
});

test('رسالةٌ واحدةٌ هي أوّلُ دفقتِها وآخرُها', () => {
  const [, msg] = buildItems([{ id: '1', direction: 'in', created_at: at('2026-09-06T10:00:00Z') }]);
  assert.equal(msg.first, true);
  assert.equal(msg.last, true);
});

test('رقمٌ من تسعِ خاناتٍ لا يبدأُ بـ05 لا يُلتقَط', () => {
  assert.equal(findMobile('الطلب رقم 123456789'), '');
  assert.equal(findMobile('السعر 40 شيكل'), '');
});

test('رقمٌ داخلَ نصٍّ طويلٍ يُلتقَطُ أوّلُه', () => {
  assert.equal(findMobile('اتصل 0592124988 أو 0599111222'), '0592124988');
});

test('الصوتُ يبقى mp3 ولو حملَ الرابطُ معاملات', () => {
  const u = 'https://res.cloudinary.com/c/video/upload/v9/ig/voice.webm?x=1';
  assert.equal(cldAudioMp3(u), 'https://res.cloudinary.com/c/video/upload/f_mp3/v9/ig/voice.mp3');
});

test('نوعُ المرفقِ لا يُخدَعُ بامتدادٍ داخلَ المسار', () => {
  assert.equal(guessKind('https://x/a.png/b'), '');
  assert.equal(guessKind('https://x/a.PNG'), 'image');
});

test('تطبيعُ العربيّةِ يُزيلُ التطويلَ والتشكيل', () => {
  assert.equal(normalizeAr('فُسْـــتان'), 'فستان');
});


// ───────── نافذةُ الردّ والقائمة ─────────
import { replyWindow, lastInboundAt, listStamp, filterConvs, matchQuick, WINDOW_MS } from './chat.js';

test('النافذةُ مفتوحةٌ قبل مرورِ يومٍ ومغلقةٌ بعده', () => {
  const now = Date.parse('2026-09-07T12:00:00Z');
  const w1 = replyWindow('2026-09-07T10:00:00Z', now);
  assert.equal(w1.open, true);
  assert.equal(w1.msLeft, WINDOW_MS - 2 * 3600 * 1000);
  const w2 = replyWindow('2026-09-06T11:00:00Z', now);
  assert.equal(w2.open, false);
  assert.equal(w2.msLeft, 0);
});

test('بلا رسالةٍ من الزبونِ لا نُعلنُ نافذةً مغلقة', () => {
  const w = replyWindow(null);
  assert.equal(w.known, false);
  assert.equal(w.open, true);
});

test('آخرُ ما كتبَه الزبونُ يتخطّى ردودَ المتجرِ بعده', () => {
  assert.equal(lastInboundAt([
    { direction: 'in', created_at: 'a' },
    { direction: 'in', created_at: 'b' },
    { direction: 'out', created_at: 'c' },
  ]), 'b');
  assert.equal(lastInboundAt([{ direction: 'out', created_at: 'c' }]), null);
});

test('ختمُ القائمة: الآن، دقائق، الساعة، أمس، يومُ الأسبوع، تاريخ', () => {
  const now = new Date(2026, 8, 10, 15, 0, 0);
  assert.equal(listStamp(new Date(2026, 8, 10, 14, 59, 40), now).kind, 'now');
  assert.deepEqual(listStamp(new Date(2026, 8, 10, 14, 45), now), { kind: 'min', value: 15 });
  assert.equal(listStamp(new Date(2026, 8, 10, 9, 0), now).kind, 'time');
  assert.equal(listStamp(new Date(2026, 8, 9, 23, 0), now).kind, 'yesterday');
  assert.equal(listStamp(new Date(2026, 8, 6, 12, 0), now).kind, 'weekday');
  assert.equal(listStamp(new Date(2026, 7, 1, 12, 0), now).kind, 'date');
  assert.equal(listStamp('garbage', now).kind, 'none');
});

test('تبويباتُ الصندوقِ والبحثُ معاً', () => {
  const convs = [
    { id: 1, customer_name: 'سارة', unread: 2, last_dir: 'in' },
    { id: 2, customer_name: 'ليلى', unread: 0, last_dir: 'out', order_id: 9 },
    { id: 3, customer_name: 'هبة', unread: 0, last_dir: 'in', last_message: 'بدي عبايه' },
  ];
  assert.deepEqual(filterConvs(convs, { tab: 'unread' }).map((c) => c.id), [1]);
  assert.deepEqual(filterConvs(convs, { tab: 'waiting' }).map((c) => c.id), [1, 3]);
  assert.deepEqual(filterConvs(convs, { tab: 'orders' }).map((c) => c.id), [2]);
  assert.deepEqual(filterConvs(convs, { q: 'عباية' }).map((c) => c.id), [3]);
  assert.deepEqual(filterConvs(convs, { q: 'عباية', tab: 'unread' }).map((c) => c.id), []);
});

test('الردودُ الجاهزةُ تُفتَحُ بـ/ وتُصفّى بما بعدَها', () => {
  const qr = ['متوفّر حبيبتي', 'السعر ١٢٠ شيكل', 'التوصيل يومين'];
  assert.equal(matchQuick(qr, 'مرحبا'), null);
  assert.deepEqual(matchQuick(qr, '/'), qr);
  assert.deepEqual(matchQuick(qr, '/سعر'), ['السعر ١٢٠ شيكل']);
  assert.deepEqual(matchQuick(qr, '/متوفر'), ['متوفّر حبيبتي'].filter((x) => normalizeAr(x).includes('متوفر')));
});

import { linkify, hostOf } from './chat.js';

test('الرابطُ يُفصَلُ عن النصِّ وتُتركُ نقطةُ آخرِ الجملة', () => {
  const parts = linkify('شوفي هاد: https://instagram.com/p/abc. حلو؟');
  assert.deepEqual(parts.map((p) => p.type), ['text', 'url', 'text']);
  assert.equal(parts[1].href, 'https://instagram.com/p/abc');
  assert.equal(parts[2].value, '. حلو؟');
});

test('www بلا بروتوكولٍ يصيرُ رابطاً صالحاً', () => {
  const parts = linkify('www.bazarastore.site/store/x');
  assert.equal(parts[0].href, 'https://www.bazarastore.site/store/x');
});

test('رقمُ الجوّالِ يصيرُ رابطَ اتّصال', () => {
  const parts = linkify('رقمي 059 123 4567 تمام');
  const ph = parts.find((p) => p.type === 'phone');
  assert.ok(ph);
  assert.equal(ph.href, 'tel:0591234567');
  const plain = linkify('رقمي 0591234567 بدي نمرة ٥٢').find((p) => p.type === 'phone');
  assert.ok(plain, 'العشرةُ أرقامٍ المتّصلةُ تُلتقَطُ أيضاً');
  assert.equal(plain.value, '0591234567');
});

test('نصٌّ بلا روابطَ يبقى قطعةً واحدة', () => {
  assert.deepEqual(linkify('مرحبا'), [{ type: 'text', value: 'مرحبا' }]);
  assert.deepEqual(linkify(''), []);
});

test('اسمُ الموقعِ بلا www', () => {
  assert.equal(hostOf('https://www.instagram.com/p/x'), 'instagram.com');
  assert.equal(hostOf('not a url'), '');
});

import { shortUrl } from './chat.js';
test('الرابطُ الطويلُ يُختصَرُ للعرض', () => {
  assert.equal(shortUrl('https://www.instagram.com/p/abc/'), 'instagram.com/p/abc');
  const long = shortUrl('https://bazarastore.site/store/demo/p/123?utm_source=ig&utm_medium=dm');
  assert.equal(long.length, 36);
  assert.ok(long.endsWith('…'));
});
console.log(`\n${passed} اختباراً ناجحاً`);
