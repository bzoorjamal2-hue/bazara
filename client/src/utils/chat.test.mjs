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

console.log(`\n${passed} اختباراً ناجحاً`);
