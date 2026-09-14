// شهادةُ شراءٍ للزبونة — نفسُ فاتورةِ صاحبةِ المتجر، بوجهٍ يخصُّ من اشترت.
//
// كانت الفاتورةُ حكراً على اللوحة: صاحبةُ المتجر تطبعُها، والزبونةُ تخرجُ من
// الطلبِ بلا ورقةٍ تُثبتُ ما دفعت. هنا نبني الشهادةَ من بياناتِ الطلبِ نفسِها
// بالمتصفّح — بلا طلبِ خادمٍ ولا صورةٍ خارجيّة (شرطُ htmlToPngBlob: أيُّ صورةٍ
// من نطاقٍ آخر تُلوّثُ الـcanvas فيسقطُ التصدير) — فتحفظُها صورةً أو PDF.
//
// الشكلُ واحدٌ للطباعةِ وللصورة، ويُقرأ بالوضعين لأنّ الورقةَ بيضاءُ دائماً.

import { htmlToPngBlob, safeFileName, downloadBlob } from './htmlImage.js';
import { printSheet } from './printSheet.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// إطارٌ ذهبيٌّ مزدوج، وخَتْمٌ مرسومٌ بالـCSS لا بصورة، وجدولٌ بسعرِ الوحدةِ
// والكميّةِ ومجموعِ كلِّ قطعة — يليقُ بورقةٍ تُحفَظُ وتُرسَل.
export const RECEIPT_CSS = `
  *{box-sizing:border-box}
  body{font-family:'Cairo','Tajawal','Segoe UI',Tahoma,Arial,sans-serif;color:#2b2420;margin:0;padding:0;background:#fff}
  /* الخطُّ مكتوبٌ على .rc نفسِها لا على body وحدَها: مسارُ حفظِ الصورة يرسمُ
     القصاصةَ داخلَ <foreignObject> بلا body، فقاعدةُ body لا تصلُها وكانت
     الشهادةُ تخرجُ بخطٍّ مُذنَّبٍ (Times) لا بخطِّ الموقع. */
  .rc,.rc *{font-family:'Cairo','Tajawal','Segoe UI',Tahoma,Arial,sans-serif}
  .rc{position:relative;max-width:820px;margin:0 auto;padding:26px 28px;background:#fffdf8;
      border:1px solid #d9c9ad;border-radius:14px;
      box-shadow:inset 0 0 0 4px #fffdf8, inset 0 0 0 5px #ecdfc6}
  .rc + .rc{page-break-before:always}
  .rc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;
           padding-bottom:14px;margin-bottom:16px;
           border-bottom:3px solid;border-image:linear-gradient(90deg,#e3d3b5,#b09a7e,#8a7657) 1}
  .rc-store{font-size:21px;font-weight:800;margin:0 0 3px;color:#6b5320;letter-spacing:.2px}
  .rc-by{font-size:10.5px;color:#a2937f;letter-spacing:1.6px;font-weight:700}
  .rc-contact{color:#6f6357;font-size:11.5px;line-height:1.8;margin-top:5px}
  .rc-meta{text-align:end;flex-shrink:0}
  .rc-tag{display:inline-block;background:linear-gradient(135deg,#cdbda4,#b09a7e);color:#3a2c1c;
          font-weight:800;font-size:11px;padding:3px 12px;border-radius:99px;margin-bottom:5px;letter-spacing:.3px}
  .rc-no{font-weight:800;font-size:16px;letter-spacing:1px;color:#3f2e22;direction:ltr}
  .rc-date{color:#8a7f72;font-size:11px;margin-top:2px}
  .rc-pay{display:inline-block;margin-top:6px;font-size:11px;font-weight:800;padding:3px 10px;
          border-radius:99px;background:#eef7f0;color:#1f7a4d;border:1px solid #cfe8da}
  .rc-pay.card{background:#eef2fb;color:#2a4a8c;border-color:#d5deef}
  .rc-grid{display:flex;gap:10px;margin-bottom:12px}
  .rc-box{flex:1;border:1px solid #ece0cb;border-radius:11px;padding:10px 12px;font-size:12.5px;line-height:1.75;background:#fff}
  .rc-box-t{color:#a2937f;font-size:10px;font-weight:800;letter-spacing:.6px;margin-bottom:3px}
  .rc-box b{color:#2b2420;font-size:13px}
  .rc-note{border:1px solid #ece0cb;border-radius:11px;padding:9px 12px;font-size:12.5px;
           background:#fbf7ee;margin-bottom:12px;line-height:1.7}
  table{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff;
        border:1px solid #ece0cb;border-radius:11px;overflow:hidden}
  th{background:linear-gradient(180deg,#f8f0dd,#f1e6cd);color:#6b5320;text-align:start;
     padding:9px 8px;border-bottom:2px solid #cdbda4;font-size:11px;font-weight:800;letter-spacing:.2px}
  td{padding:8px;border-bottom:1px solid #f4ede0;vertical-align:middle}
  tbody tr:last-child td{border-bottom:1px solid #ece0cb}
  .n{width:30px;text-align:center;color:#a2937f}
  .c{text-align:center;width:70px}
  .e{text-align:end;width:98px}
  .b{font-weight:800;color:#3f2e22}
  .lbl{color:#6f6357}
  tfoot td{padding:7px 8px;border-bottom:none}
  tfoot .save td{color:#1f7a4d;font-weight:700}
  .rc-total td{font-weight:800;font-size:16px;color:#5a4416;
               border-top:2px solid #cdbda4;background:linear-gradient(180deg,#fdf7e8,#f8eed8)}
  /* الباقي عند الباب: يُقرأُ قبل الإجماليِّ نفسِه لأنّه المبلغُ المطلوبُ الآن */
  .rc-due td{font-weight:800;font-size:15px;color:#8a5a12;background:#fdf4e3;border-top:1px solid #e8d6ae}
  .rc-due-note{margin-top:8px;font-size:11.5px;line-height:1.7;color:#6f6357;
               background:#fdf7ec;border:1px dashed #e0d2b8;border-radius:10px;padding:8px 11px}
  .rc-foot{display:flex;align-items:center;gap:14px;margin-top:16px;padding-top:14px;
           border-top:1px dashed #e0d2b8}
  .rc-seal{width:64px;height:64px;flex-shrink:0;border-radius:50%;
           background:linear-gradient(140deg,#f6ecd6,#e6d5b4);border:2px solid #c3ad8b;
           display:flex;align-items:center;justify-content:center;text-align:center;
           font-size:9px;font-weight:800;color:#6b5320;line-height:1.25;padding:6px;letter-spacing:.2px}
  .rc-thanks{flex:1;font-size:12px;color:#6f6357;line-height:1.8}
  .rc-thanks b{color:#3f2e22}
  .rc-site{color:#a2937f;font-size:10.5px;letter-spacing:.4px;margin-top:3px}
`;

// تخطيطٌ مضغوطٌ للورقةِ الضيّقة (صورةُ الجوّال) — الأعمدةُ الثانويّةُ تسقطُ
// والصناديقُ تصيرُ فوق بعضِها، فتُقرأ الشهادةُ بشاشةِ هاتفٍ بلا تكبير.
export const RECEIPT_NARROW_CSS = `
  .rc{padding:16px 14px}
  .rc-head{flex-direction:column;gap:8px}
  .rc-meta{text-align:start}
  .rc-grid{flex-direction:column;gap:8px}
  th.n,td.n,th.u,td.u{display:none}
  table{font-size:11.5px}
  th,td{padding:6px 5px}
  .c{width:auto}
  .e{width:auto}
  .rc-foot{flex-direction:column;text-align:center;gap:10px}
`;

/**
 * جسمُ الشهادة.
 * @param {object} o الطلب: reference/createdAt/storeName/storeSlug/storeWhatsapp/
 *                 customerName/customerPhone/city/area/address/notes/eta/items/
 *                 subtotal/discount/couponCode/deliveryFee/total/paymentMethod
 * @param {Function} t مترجمُ i18n
 */
export function receiptBody(o, t) {
  const cur = t('common.currency');
  const items = Array.isArray(o.items) ? o.items : [];
  const num = (v) => Number(v) || 0;
  const pieces = items.reduce((s, i) => s + num(i.qty), 0);
  const subtotal = num(o.subtotal) || items.reduce((s, i) => s + num(i.price) * num(i.qty), 0);
  const discount = num(o.discount);
  const delivery = num(o.deliveryFee);
  const total = num(o.total) || Math.max(0, subtotal - discount) + delivery;
  const saved = items.reduce((s, i) => s + (num(i.oldPrice) > num(i.price) ? (num(i.oldPrice) - num(i.price)) * num(i.qty) : 0), 0);
  const card = o.paymentMethod === 'card';
  // قسمةُ المبلغِ بطلبِ البطاقة: البضاعةُ سُدِّدت إلكترونيّاً، والتوصيلُ يُدفَعُ
  // نقداً للمندوب. الشهادةُ ورقةُ الزبونِ عند البابِ فلا يجوزُ أن تُخفيَ الباقي.
  const paid = card ? Math.max(0, total - delivery) : 0;
  const due = card ? delivery : total;

  const rows = items.map((it, i) => `<tr>
    <td class="n">${i + 1}</td>
    <td>${esc(it.name)}</td>
    <td class="c">${esc(it.size || '—')}</td>
    <td class="c">${esc(it.color || '—')}</td>
    <td class="e u">${cur}${num(it.price).toFixed(2)}</td>
    <td class="c">${esc(it.qty)}</td>
    <td class="e b">${cur}${(num(it.price) * num(it.qty)).toFixed(2)}</td>
  </tr>`).join('');

  const line = (lbl, val, cls = '') => `<tr class="${cls}"><td colspan="6" class="e lbl">${esc(lbl)}</td><td class="e">${esc(val)}</td></tr>`;
  const place = [o.city, o.area && o.area !== o.city ? o.area : ''].filter(Boolean).join(' - ');
  const when = o.createdAt ? new Date(o.createdAt) : new Date();

  return `
    <div class="rc">
      <div class="rc-head">
        <div>
          <h1 class="rc-store">${esc(o.storeName || 'Bazara')}</h1>
          <div class="rc-by">${esc(t('receipt.poweredBy'))}</div>
          <div class="rc-contact">
            ${o.storeWhatsapp ? `${esc(t('receipt.storeWhatsapp'))}: <span dir="ltr">${esc(o.storeWhatsapp)}</span><br>` : ''}
            ${o.storeSlug ? `bazarastore.site/store/${esc(o.storeSlug)}` : ''}
          </div>
        </div>
        <div class="rc-meta">
          <div class="rc-tag">${esc(t('receipt.title'))}</div>
          <div class="rc-no">${esc(o.reference || '—')}</div>
          <!-- التاريخُ أرقامٌ لاتينيّةٌ بترتيبٍ ثابت: بلا dir=ltr ينقلبُ داخلَ
               ورقةٍ عربيّةٍ فيصيرُ «PM 3:24 ,9/14/2026» -->
          <div class="rc-date" dir="ltr">${esc(when.toLocaleString())}</div>
          <div class="rc-pay${card ? ' card' : ''}">${esc(
            card ? (due > 0 ? t('receipt.paidCardGoods') : t('receipt.paidCard')) : t('receipt.payCod')
          )}</div>
        </div>
      </div>

      <div class="rc-grid">
        <div class="rc-box">
          <div class="rc-box-t">${esc(t('receipt.buyer'))}</div>
          <b>${esc(o.customerName || '—')}</b><br>
          <span dir="ltr">${esc(o.customerPhone || '')}</span>
        </div>
        <div class="rc-box">
          <div class="rc-box-t">${esc(t('receipt.deliverTo'))}</div>
          <b>${esc(place || '—')}</b><br>
          <span>${esc(o.address || '')}</span>
          ${o.eta ? `<br><span>${esc(o.eta)}</span>` : ''}
        </div>
      </div>
      ${o.notes ? `<div class="rc-note"><div class="rc-box-t">${esc(t('receipt.notes'))}</div>${esc(o.notes)}</div>` : ''}

      <table>
        <thead><tr>
          <th class="n">#</th>
          <th>${esc(t('receipt.item'))}</th>
          <th class="c">${esc(t('receipt.size'))}</th>
          <th class="c">${esc(t('receipt.color'))}</th>
          <th class="e u">${esc(t('receipt.unitPrice'))}</th>
          <th class="c">${esc(t('receipt.qty'))}</th>
          <th class="e">${esc(t('receipt.lineTotal'))}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          ${line(`${t('receipt.subtotal')} (${t('receipt.pieces', { count: pieces })})`, `${cur}${subtotal.toFixed(2)}`)}
          ${saved > 0 ? line(t('receipt.saved'), `${cur}${saved.toFixed(2)}`, 'save') : ''}
          ${discount > 0 ? line(`${t('receipt.discount')}${o.couponCode ? ` (${o.couponCode})` : ''}`, `−${cur}${discount.toFixed(2)}`, 'save') : ''}
          ${line(t('receipt.delivery'), delivery > 0 ? `${cur}${delivery.toFixed(2)}` : t('receipt.freeDelivery'))}
          <tr class="rc-total"><td colspan="6" class="e">${esc(t('receipt.total'))}</td><td class="e">${cur}${total.toFixed(2)}</td></tr>
          ${/* بطلبِ البطاقة: سطرانِ يفصلانِ المدفوعَ عن الباقي — فيعرفُ حاملُ
               الورقةِ ومَن يسلّمُه الطردَ كم بقي بالضبط */''}
          ${card && due > 0 ? `
            ${line(t('receipt.paidLine'), `${cur}${paid.toFixed(2)}`, 'save')}
            <tr class="rc-due"><td colspan="6" class="e">${esc(t('receipt.dueLine'))}</td><td class="e">${cur}${due.toFixed(2)}</td></tr>
          ` : ''}
        </tfoot>
      </table>
      ${card && due > 0 ? `<div class="rc-due-note">${esc(t('receipt.dueNote'))}</div>` : ''}

      <div class="rc-foot">
        <div class="rc-seal">${esc(t('receipt.sealLine1'))}<br>${esc(t('receipt.sealLine2'))}</div>
        <div class="rc-thanks">
          <b>${esc(t('receipt.thanks', { name: o.customerName || '' }))}</b><br>
          ${esc(t('receipt.keepIt'))}
          <div class="rc-site">bazarastore.site</div>
        </div>
      </div>
    </div>`;
}

// اسمُ الملفِّ: رقمُ الطلبِ واسمُ المتجر — يُعرَفُ بين ملفّاتِ التنزيلاتِ بلا فتح
export const receiptFileName = (o, t) =>
  safeFileName(`${t('receipt.fileName')} ${o.reference || ''} ${o.storeName || ''}`.trim(), o.reference || 'receipt');

/** طباعةُ الشهادة (ومنها «حفظ كـPDF» بحوارِ الطباعة) */
export function printReceipt(o, t, dir = 'rtl') {
  printSheet(receiptBody(o, t), `${RECEIPT_CSS}@page{size:A4;margin:10mm}`, receiptFileName(o, t), dir);
}

/** حفظُ الشهادةِ صورةَ PNG — أسهلُ ما يُرسَلُ بواتساب ويُحفَظُ بمعرضِ الجوّال */
export async function saveReceiptImage(o, t, dir = 'rtl') {
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640;
  const css = `${RECEIPT_CSS}${narrow ? RECEIPT_NARROW_CSS : ''}`;
  const blob = await htmlToPngBlob(receiptBody(o, t), css, narrow ? 560 : 820, 2, dir);
  downloadBlob(blob, `${receiptFileName(o, t)}.png`);
}
