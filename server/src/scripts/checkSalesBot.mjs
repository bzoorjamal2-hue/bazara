// فحصُ البائعةِ الآليّةِ كاملاً على بياناتِ متجرٍ حقيقيّ:  npm run check:bot
//
// يُشغَّلُ قبلَ كلِّ إطلاقٍ أو تعديلٍ على المحرّك. لا يكتبُ شيئاً بالقاعدة: ما
// يحتاجُ كتابةً يجري داخلَ معاملةٍ تُلغى، بما فيها تسجيلُ طلبٍ حقيقيٍّ يُقرَأُ
// كما تراه التاجرةُ ثمّ يختفي. فالحارسُ الذي لا يُختبَرُ ليس حارساً.
//
// المتجرُ يُختارُ بـ  npm run check:bot -- <slug>  وإلّا فأوّلُ متجرٍ فعّلَ البائعة.
import 'dotenv/config';
import crypto from 'crypto';
import { query, withTransaction } from '../config/db.js';
import {
  loadBot, sanitize, allowedPrice, effectiveFloor, haggleMargin, DEFAULT_HAGGLE_MARGIN,
  normalizePhone, testModeAllows, botActiveNow, stockLine, sizesOf, colorsOf, MAX_HAGGLE_MARGIN,
  variantAvailable, haggleIntent, needsHuman, clearCatalog,
} from '../utils/salesAgent.js';
import { feeForCity, cityOfVillage } from '../config/deliveryCities.js';
import { shouldResume } from '../controllers/instagram.controller.js';
import { orderProfit } from '../controllers/order.controller.js';

let ok = 0; let bad = 0;
const t = (n, c, x = '') => {
  if (c) { ok += 1; console.log('  ✓ ' + n); } else { bad += 1; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); }
};
const H = (s) => console.log('\n── ' + s + ' ' + '─'.repeat(Math.max(0, 56 - s.length)));

const slug = process.argv[2] || '';
const st = (await query(
  slug
    ? 'SELECT * FROM stores WHERE slug = $1'
    : 'SELECT * FROM stores WHERE bot_enabled = true ORDER BY created_at LIMIT 1',
  slug ? [slug] : []
)).rows[0];
if (!st) { console.log('✗ لا متجرَ للفحص. مرّرْ slug أو فعّلِ البائعةَ على متجر.'); process.exit(1); }

const bot = await loadBot(st.id);
const rows = (await query(
  `SELECT id, name, price, floor_price, cost, stock, size_stock, color_stock, size, color,
          old_price, sale_ends_at, category, description
     FROM products WHERE store_id = $1 AND hidden_at IS NULL ORDER BY created_at DESC`,
  [st.id]
)).rows;
if (!rows.length) { console.log('✗ المتجرُ بلا قطعٍ معروضة.'); process.exit(1); }

console.log('المتجر: ' + st.name + ' (' + st.slug + ') · قطع=' + rows.length);
console.log('البائعة: مشغّلة=' + bot.bot_enabled + ' · قنوات=' + JSON.stringify(bot.bot_channels)
  + ' · مفاصلة=' + bot.bot_haggle + ' (هامش ₪' + haggleMargin(bot) + '، ' + bot.bot_haggle_steps + ' درجات)');

// ═════════════════════════ المخزون ═════════════════════════
H('١) المخزونُ من القاعدةِ لا من رأسِ النموذج');
for (const p of rows.slice(0, 3)) {
  const sz = sizesOf(p); const cl = colorsOf(p);
  console.log('    «' + p.name.slice(0, 34) + '» ₪' + p.price + ' → ' + stockLine(p).slice(0, 90));
  if (cl.length && sz.length) {
    t('متغيّرٌ موجودٌ يُقبَل (' + cl[0] + '/' + sz[0] + ')', variantAvailable(p, cl[0], sz[0]));
    t('لونٌ وهميٌّ يُرفَض', !variantAvailable(p, 'زهري فسفوري', sz[0]));
    t('نمرةٌ وهميّةٌ تُرفَض', !variantAvailable(p, cl[0], '999'));
  }
}
t('ما نفدَ كلُّه لا يُعرَضُ كمتوفّر',
  rows.every((p) => !/^نفد$/.test(stockLine(p)) || sizesOf(p).length === 0));

// ═════════════════════════ المفاصلة ═════════════════════════
H('٢) الهامشُ يشملُ القطعَ الحاليّةَ والقادمة');
const margin = haggleMargin(bot);
t('متجرٌ بلا إعدادٍ يأخذُ ' + DEFAULT_HAGGLE_MARGIN + ' افتراضاً', haggleMargin({}) === DEFAULT_HAGGLE_MARGIN);
t('هامشٌ تالفٌ أو صفرٌ يعودُ للافتراضيّ',
  haggleMargin({ bot_haggle_margin: 'abc' }) === DEFAULT_HAGGLE_MARGIN && haggleMargin({ bot_haggle_margin: 0 }) === DEFAULT_HAGGLE_MARGIN);
const auto = rows.filter((p) => p.floor_price == null);
t('كلُّ قطعةٍ بلا أرضيّةٍ مكتوبةٍ تأخذُ الهامش',
  auto.every((p) => Number(p.price) <= margin || Math.abs(Number(p.price) - effectiveFloor(p, bot) - margin) < 0.01));
const future = { id: 'x', name: 'قطعةٌ ستُضاف', price: 250, floor_price: null };
t('قطعةٌ جديدةٌ (٢٥٠) تأخذُه بلا أن يلمسَها أحد', effectiveFloor(future, bot) === 250 - margin);
t('سعرٌ يتغيّرُ (٣٢٠) يبقى هامشُه صحيحاً', effectiveFloor({ ...future, price: 320 }, bot) === 320 - margin);
t('قطعةٌ ثمنُها كالهامشِ أو أقلّ ⇒ لا مفاصلة', effectiveFloor({ ...future, price: margin }, bot) === null);
t('سعرٌ صفرٌ أو تالفٌ ⇒ لا مفاصلة',
  effectiveFloor({ ...future, price: 0 }, bot) === null && effectiveFloor({ ...future, price: 'x' }, bot) === null);
// أرضيّةٌ **أضيقُ** من الهامش: هذا ما يبقى للتاجرةِ بعدَ السقف — أن تُقلِّلَ
// نزولَ بائعتِها على قطعةٍ بعينِها، لا أن تزيدَه.
t('أرضيّةٌ أضيقُ كتبَتْها التاجرةُ تتقدَّمُ على الهامش', effectiveFloor({ ...future, floor_price: 245 }, bot) === 245);
t('أرضيّةٌ فوقَ السعرِ ⇒ لا مفاصلةَ (لا نخترعُ بديلاً)', effectiveFloor({ ...future, floor_price: 300 }, bot) === null);

H('٢ب) سقفُ المنصّة: عشرةٌ ولا شيقلَ أكثرَ على أحد');
t('السقفُ ' + MAX_HAGGLE_MARGIN, MAX_HAGGLE_MARGIN === 10);
t('هامشُ متجرٍ فوقَ السقفِ يُقصَرُ إليه', haggleMargin({ bot_haggle_margin: 200 }) === MAX_HAGGLE_MARGIN);
t('أرضيّةٌ يدويّةٌ أبعدُ من السقفِ تُرفَعُ إليه لا تُلغى',
  effectiveFloor({ ...future, floor_price: 100 }, bot) === 250 - MAX_HAGGLE_MARGIN,
  String(effectiveFloor({ ...future, floor_price: 100 }, bot)));
t('أرضيّةٌ يدويّةٌ داخلَ السقفِ تُحترَمُ كما هي', effectiveFloor({ ...future, floor_price: 245 }, bot) === 245);
t('ولا قطعةَ بالمتجرِ تنزلُ أكثرَ من السقف',
  rows.every((x) => effectiveFloor(x, bot) == null || Number(x.price) - effectiveFloor(x, bot) <= MAX_HAGGLE_MARGIN));
t('ولا درجةَ سُلَّمٍ تتجاوزُه مهما ألحَّ الزبون',
  rows.every((x) => [0, 1, 2, 3, 9].every((sg) => Number(x.price) - allowedPrice(x, { ...bot, bot_haggle: true }, sg) <= MAX_HAGGLE_MARGIN)));

H('٣) السُّلَّم: تتمسّكُ أوّلاً ثمّ تنزلُ الهامش');
const hp = rows.find((p) => effectiveFloor(p, bot) != null) || rows[0];
const price = Number(hp.price);
const floor = effectiveFloor(hp, bot);
const hb = { ...bot, bot_haggle: true, bot_haggle_steps: 2 };
const L = [0, 1, 2, 3].map((s) => allowedPrice(hp, hb, s));
console.log('    «' + hp.name.slice(0, 34) + '» ₪' + price + ' (أرضيّة ₪' + floor + ') → ' + L.join(' ← '));
t('قبلَ أيِّ مفاصلة: السعرُ الكامل', L[0] === price);
t('أوّلُ «غالي»: تتمسّكُ ولا تنزلُ شيقلاً', L[1] === price, String(L[1]));
t('ثاني «غالي»: تُعطي الهامشَ كاملاً', L[2] === floor, String(L[2]));
t('إلحاحٌ بعدَها: تبقى عندَ الأرضيّة', L[3] === floor);
t('لا درجةَ تنزلُ تحتَ الأرضيّة', L.every((x) => x >= floor), L.join(','));
t('السُّلَّمُ لا يصعدُ أبداً', L.every((x, i) => i === 0 || x <= L[i - 1]));
// قطعةٌ غاليةٌ كتبت لها التاجرةُ أرضيّةً بعيدة: السقفُ يحكمُ لا هي.
const big = { id: 'y', name: 'غالية', price: 300, floor_price: 200 };
t('قطعةٌ غاليةٌ بأرضيّةٍ بعيدةٍ لا تنزلُ إلّا السقف',
  allowedPrice(big, hb, 1) === 300 && allowedPrice(big, hb, 2) === 300 - MAX_HAGGLE_MARGIN,
  allowedPrice(big, hb, 1) + '←' + allowedPrice(big, hb, 2));
t('المفاصلةُ مُطفأةً ⇒ لا نزولَ بأيِّ درجة',
  [0, 1, 2, 3].every((s) => allowedPrice(hp, { ...hb, bot_haggle: false }, s) === price));

// ═════════════════════ حارسُ ما يخرجُ للزبون ═════════════════════
H('٤) حارسُ السعرِ — ولا يُفسدُ النمر');
const sp = rows.find((p) => sizesOf(p).length >= 2) || hp;
const spSizes = sizesOf(sp);
const g = (reply, stage = 0) => sanitize({ reply, productIds: [sp.id] }, { rows, bot: hb, stage }).reply;
const spFloor = effectiveFloor(sp, hb);
if (spSizes.length >= 2) {
  const o1 = g('بتفضلي نمرة ' + spSizes[0] + ' ولا ' + spSizes[1] + '؟', 2);
  t('النمرُ المجرّدةُ تبقى كما هي', o1.includes(String(spSizes[0])) && o1.includes(String(spSizes[1])), o1);
  const o2 = g('النمرة ' + spSizes[0] + ' شيكل؟', 2);
  t('نمرةٌ مقرونةٌ بعملةٍ لا تُمَسُّ', o2.includes(String(spSizes[0])), o2);
}
const o3 = g('خلص بعطيكي ياها بـ1 شيكل', 2);
t('رقمٌ تحتَ الأرضيّةِ يُرفَعُ إليها', o3.includes(String(spFloor)), o3);
const o4 = g('بعطيكي ياها بـ' + spFloor + ' شيكل', 1);
t('خصمٌ بجولةِ التمسّكِ يُلغى', o4.includes(String(Number(sp.price))), o4);
t('رقمٌ بلا عملةٍ لا يُمَسُّ', g('عندي 3 قطع بالمخزن', 2).includes('3 قطع'));
const off = (p, s) => sanitize({ reply: 'تمام', productIds: [sp.id], offerProductId: sp.id, offerPrice: p },
  { rows, bot: hb, stage: s }).offer;
t('العرضُ المنظَّمُ لا ينزلُ تحتَ الأرضيّة', off(1, 2).price === spFloor);
t('العرضُ لا يتجاوزُ السعرَ المعروض', off(99999, 2).price === Number(sp.price));

// ═════════════════════════ الطلب ═════════════════════════
H('٥) رقمُ الجوّالِ الفلسطينيّ');
for (const [raw, want] of [['0592124988', '0592124988'], ['+970592124988', '0592124988'],
  ['00970592124988', '0592124988'], ['972592124988', '0592124988'], ['٠٥٩٢١٢٤٩٨٨', '0592124988'],
  ['059-212-4988', '0592124988'], ['12345', ''], ['042124988', ''], ['059212498', ''], ['', '']]) {
  t('«' + (raw || 'فارغ') + '» → «' + normalizePhone(raw) + '»', normalizePhone(raw) === want, 'المتوقّع ' + (want || 'فارغ'));
}

H('٦) مدقّقُ الطلبِ — لا يُسجَّلُ ناقصٌ ولا وهميّ');
const pick = rows.find((p) => colorsOf(p).length && sizesOf(p).length) || rows[0];
const full = {
  productId: pick.id, color: colorsOf(pick)[0] || '', size: sizesOf(pick)[0] || '', qty: 1,
  name: 'جمال فراس عمر', phone: '0592124988', city: 'رابا', address: 'رابا — قرب المدرسة',
};
const chk = (o) => sanitize({ reply: 'تمام', productIds: [pick.id], order: o }, { rows, bot, stage: 0 }).order;
t('طلبٌ كاملٌ = جاهز', chk(full).ready, chk(full).missing.join(','));
t('بلا اسمٍ ⇒ ناقص', chk({ ...full, name: '' }).missing.includes('name'));
t('اسمٌ من كلمةٍ واحدةٍ ⇒ ناقص', chk({ ...full, name: 'جمال' }).missing.includes('name'));
t('رقمٌ غيرُ صالحٍ ⇒ ناقص', chk({ ...full, phone: '123' }).missing.includes('phone'));
t('بلا مدينةٍ ⇒ ناقص', chk({ ...full, city: '' }).missing.includes('city'));
t('بلا عنوانٍ ⇒ ناقص', chk({ ...full, address: '' }).missing.includes('address'));
t('لونٌ وهميٌّ يمنعُ الطلب', chk({ ...full, color: 'ذهبي لامع' }).ready === false);
t('نمرةٌ نفدت تمنعُ الطلب', chk({ ...full, size: '999' }).ready === false);
t('قطعةٌ من متجرٍ آخرَ تُرفَض',
  chk({ ...full, productId: '00000000-0000-0000-0000-000000000000' }).product?.id !== '00000000-0000-0000-0000-000000000000');
t('كميّةٌ مجنونةٌ تُقصَرُ على ١٠', chk({ ...full, qty: 9999 }).qty === 10);
t('كميّةٌ سالبةٌ تصيرُ واحدة', chk({ ...full, qty: -3 }).qty === 1);

H('٧) التوصيل: القريةُ تُرجَعُ لمدينتِها');
t('«رابا» أمُّها «جنين»', cityOfVillage('رابا') === 'جنين');
t('«جنين» مدينةٌ لا قرية', cityOfVillage('جنين') === '');
t('أجرةُ القريةِ = أجرةُ مدينتِها',
  feeForCity('رابا', st.delivery_tiers) === feeForCity('جنين', st.delivery_tiers));
t('مدينةٌ فارغةٌ ⇒ صفر', feeForCity('', st.delivery_tiers) === 0);

H('٨) طلبٌ حقيقيٌّ يُكتَبُ بالقاعدةِ ثمّ يُلغى');
const order = chk(full);
let seen = null;
try {
  await withTransaction(async (q) => {
    const p = (await q(
      'SELECT id, name, price, cost FROM products WHERE id = $1 AND store_id = $2 AND hidden_at IS NULL',
      [order.product.id, st.id]
    )).rows[0];
    const unit = Number(p.price);
    const subtotal = unit * order.qty;
    let cityName = String(order.city || '').trim();
    let areaName = '';
    const parent = cityOfVillage(cityName);
    if (parent) { areaName = cityName; cityName = parent; }
    const dFee = feeForCity(cityName, st.delivery_tiers);
    const freeOver = Number(st.free_shipping_over) || 0;
    const fee = freeOver > 0 && subtotal >= freeOver ? 0 : dFee;
    const reference = 'BZ-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    const items = [{
      id: p.id, name: p.name, price: unit, qty: order.qty,
      size: order.size || '', color: order.color || '',
      cost: p.cost != null ? Number(p.cost) : null,
    }];
    const ins = await q(
      `INSERT INTO orders (store_id, customer_name, customer_email, customer_phone, items, total,
         currency, status, reference, city, area, address, notes, delivery_fee)
       VALUES ($1,$2,'',$3,$4,$5,'ILS','new',$6,$7,$8,$9,$10,$11) RETURNING id`,
      [st.id, order.name, order.phone, JSON.stringify(items), subtotal + fee, reference,
        cityName, areaName, order.address, 'طلب سجّلته البائعة الآلية من رسائل إنستغرام', fee]
    );
    seen = (await q(
      `SELECT reference, customer_name, customer_phone, city, area, address, total,
              delivery_fee, status, currency, items FROM orders WHERE id = $1`, [ins.rows[0].id]
    )).rows[0];
    throw new Error('__ROLLBACK__');
  });
} catch (e) { if (e.message !== '__ROLLBACK__') { console.log('  ✗ فشلَ الإدراج: ' + e.message); bad += 1; } }

if (seen) {
  const it = seen.items[0];
  console.log('    ' + seen.reference + ' · ' + seen.customer_name + ' · ' + seen.customer_phone);
  console.log('    ' + seen.city + (seen.area ? ' / ' + seen.area : '') + ' — ' + seen.address);
  console.log('    ' + it.name + ' · ' + it.color + ' · نمرة ' + it.size + ' → ₪' + seen.total
    + ' (منها ₪' + seen.delivery_fee + ' توصيل)');
  const prof = orderProfit({ items: seen.items, total: seen.total, delivery_fee: seen.delivery_fee });
  console.log('    الربح: ' + (prof.complete ? '₪' + prof.profit + (prof.exact ? ' مؤكّد' : ' تقديريّ') : 'غير محسوب — القطعة بلا تكلفة'));
  t('رقمُ الطلبِ بصيغةِ الموقعِ نفسِها', /^BZ-[0-9A-F]{10}$/.test(seen.reference));
  t('الحالةُ «new» كطلبِ الدفعِ عندَ الاستلام', seen.status === 'new');
  t('المدينةُ هي الأمُّ والقريةُ بحقلِها', seen.city === 'جنين' && seen.area === 'رابا');
  t('الإجمالي = الثمنُ + التوصيل', Number(seen.total) === Number(it.price) * it.qty + Number(seen.delivery_fee));
  t('البندُ يحملُ اللونَ والنمرةَ ولقطةَ التكلفة',
    Boolean(it.color && it.size) && Object.prototype.hasOwnProperty.call(it, 'cost'));
  t('لم يبقَ للطلبِ أثر',
    (await query('SELECT 1 FROM orders WHERE reference = $1', [seen.reference])).rows.length === 0);
}

// ═════════════════════════ الحُرّاس ═════════════════════════
H('٨ب) الحارسُ الأخير: مخزونٌ يُقرأُ لحظةَ التسجيلِ لا من الكاش');
// نُعطّلُ النمرةَ داخلَ معاملةٍ تُلغى، ونسألُ الحارسَ نفسَه الذي يقفُ بـcreateChatOrder
try {
  await withTransaction(async (q) => {
    const before = (await q('SELECT color_stock, size_stock, stock FROM products WHERE id = $1', [pick.id])).rows[0];
    t('قبلَ التصفير: المتغيّرُ متاح', variantAvailable(before, order.color, order.size));
    if (order.color && before.color_stock && Object.keys(before.color_stock).length) {
      await q(
        `UPDATE products SET color_stock = jsonb_set(color_stock, ARRAY[$2::text, $3::text], '0'::jsonb) WHERE id = $1`,
        [pick.id, order.color, order.size]
      );
    } else {
      await q('UPDATE products SET stock = 0, size_stock = $2 WHERE id = $1', [pick.id, JSON.stringify({})]);
    }
    const after = (await q('SELECT color_stock, size_stock, stock FROM products WHERE id = $1', [pick.id])).rows[0];
    t('بعدَ نفادِها: الحارسُ يرفضُ تسجيلَ الطلب', !variantAvailable(after, order.color, order.size));
    t('ولونٌ آخرُ ما زالَ يُقبَل',
      colorsOf(after).length === 0 || colorsOf(after).some((c) => sizesOf(after).some((z) => variantAvailable(after, c, z))));
    throw new Error('__ROLLBACK__');
  });
} catch (e) { if (e.message !== '__ROLLBACK__') { console.log('  ✗ ' + e.message); bad += 1; } }
const back = (await query('SELECT color_stock, size_stock, stock FROM products WHERE id = $1', [pick.id])).rows[0];
t('ورجعَ المخزونُ كما كانَ بلا أثر', variantAvailable(back, order.color, order.size));

H('٩) وضعُ التجربةِ والقنواتُ والدوام');
t('قائمةٌ فارغةٌ والوضعُ مُفعَّل ⇒ لا أحدَ يمرّ', !testModeAllows({ bot_test_only: true, bot_test_accounts: [] }, 'anyone'));
t('اسمٌ غيرُ مذكورٍ يُمنَع', !testModeAllows({ bot_test_only: true, bot_test_accounts: ['jamal._fi'] }, 'someone'));
t('الاسمُ المذكورُ يمرّ', testModeAllows({ bot_test_only: true, bot_test_accounts: ['jamal._fi'] }, 'jamal._fi'));
t('فرقُ نقطةٍ واحدةٍ يُمنَع', !testModeAllows({ bot_test_only: true, bot_test_accounts: ['jamal_fi'] }, 'jamal._fi'));
t('بلا اسمٍ يُمنَع', !testModeAllows({ bot_test_only: true, bot_test_accounts: ['jamal._fi'] }, ''));
t('مُطفأةٌ ⇒ لا تردّ', !botActiveNow({ ...bot, bot_enabled: false }, 'instagram'));
t('قناةٌ غيرُ مُفعَّلةٍ ⇒ لا تردّ', !botActiveNow({ ...bot, bot_enabled: true, bot_channels: ['site'], bot_mode: 'always' }, 'instagram'));
t('بلا إعداداتٍ (null) ⇒ لا تردّ', !botActiveNow(null, 'instagram'));
t('«بدي أرجع القطعة» يُسلَّمُ لإنسان', needsHuman('بدي ارجع القطعة'));
t('«بدي أشتري» لا يُسلَّم', !needsHuman('بدي اشتري'));
t('«غالي» مفاصلةٌ و«حلوة كتير» ليست', haggleIntent('غالي شوي') && !haggleIntent('حلوة كتير'));

H('١٠) التسليمُ للتاجرةِ لا يدومُ للأبد');
const NOW = Date.now();
const ago = (h) => new Date(NOW - h * 3600000).toISOString();
t('ختمٌ فارغٌ (تسليمٌ قديم) ⇒ يُرفَع', shouldResume({ pausedAt: null, now: NOW }));
t('سُلِّمَت قبلَ دقيقةٍ ⇒ تبقى لها', !shouldResume({ pausedAt: ago(0.02), now: NOW }));
t('سُلِّمَت قبلَ ٥ ساعاتٍ ⇒ ما زالت لها', !shouldResume({ pausedAt: ago(5), now: NOW }));
t('مضت ٦ ساعاتٍ بلا ردٍّ ⇒ يُرفَع', shouldResume({ pausedAt: ago(6), now: NOW }));
t('ردَّت التاجرةُ بعدَه ⇒ يُرفَعُ فوراً', shouldResume({ pausedAt: ago(0.02), ownerRepliedAfter: true, now: NOW }));
t('«ردّت» بقيمةٍ غيرِ منطقيّةٍ لا تُصدَّق', !shouldResume({ pausedAt: ago(1), ownerRepliedAfter: 'نعم', now: NOW }));
const stuck = (await query(
  'SELECT bot_paused_at FROM ig_conversations WHERE store_id = $1 AND bot_paused = true', [st.id]
)).rows;
t('لا محادثةَ عالقةٌ بلا مَن يردُّ عليها',
  stuck.every((c) => shouldResume({ pausedAt: c.bot_paused_at })), stuck.length + ' موقوفة');

clearCatalog(st.id);
console.log('\n' + '═'.repeat(58));
console.log(bad ? ('✗ ' + bad + ' فاشل من ' + (ok + bad)) : ('✓ ' + ok + '/' + ok + ' — النظامُ سليم'));
process.exit(bad ? 1 : 0);
