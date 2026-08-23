// مقاسات ورق طباعة الفواتير.
//
// كل متجر وطابعته: في اللي عندها A4 عادي، وفي اللي بتطبع ملصقات شحن ١٠×١٥ سم،
// وفي طابعات إيصالات برول ٨٠ مم. الفاتورة كانت مربوطة بـA4 ثابتة، فتطلع مقصوصة
// أو ضايعة بنص الورقة على أي طابعة ثانية. هون منعرّف كل مقاس بثلاث قيَم:
//   page — قياس @page (اسم ISO أو أبعاد صريحة؛ "auto" للرول لأن طوله بلا حدّ)
//   zoom — تكبير/تصغير المحتوى ليملأ الورقة (بلا ما نلمس أحجام الخطوط وحدة وحدة)
//   narrow — تخطيط مضغوط للورق الضيّق (≤ ١٠ سم): بلا عمود الترقيم وسعر الوحدة،
//            والترويسة وصناديق البيانات فوق بعض بدل جنب بعض
//
// الاختيار محفوظ على جهاز صاحب المتجر لأن الورقة صفة الطابعة نفسها — بيقدر يطبع
// A4 من الكمبيوتر وملصق من جهاز آخر بلا ما يغيّر إعداداً كل مرّة.

export const PAPERS = [
  { id: 'a4', page: 'A4', margin: '10mm', zoom: 1 },
  { id: 'a5', page: 'A5', margin: '8mm', zoom: 0.85 },
  { id: 'a3', page: 'A3', margin: '12mm', zoom: 1.4 },
  { id: 'a2', page: 'A2', margin: '15mm', zoom: 2 },
  { id: 'letter', page: 'Letter', margin: '10mm', zoom: 1 },
  { id: 'label10x15', page: '100mm 150mm', margin: '4mm', zoom: 0.72, narrow: true },
  { id: 'label10x10', page: '100mm 100mm', margin: '4mm', zoom: 0.55, narrow: true },
  { id: 'roll80', page: '80mm auto', margin: '3mm', zoom: 0.62, narrow: true },
  { id: 'roll58', page: '58mm auto', margin: '2mm', zoom: 0.5, narrow: true },
];

export const DEFAULT_PAPER = 'a4';
const KEY = 'bz_invoice_paper';

export const paperById = (id) => PAPERS.find((p) => p.id === id) || PAPERS[0];

export function getPaper() {
  try {
    const v = localStorage.getItem(KEY);
    return PAPERS.some((p) => p.id === v) ? v : DEFAULT_PAPER;
  } catch { return DEFAULT_PAPER; }
}

export function savePaper(id) {
  try { localStorage.setItem(KEY, paperById(id).id); } catch { /* وضع التصفّح الخاص */ }
}

// أنماط خاصة بالمقاس تُضاف فوق أنماط الفاتورة الأساسية
export function paperCss(id) {
  const p = paperById(id);
  return `
    @page{size:${p.page};margin:${p.margin}}
    .inv{zoom:${p.zoom}}
    ${p.narrow ? `
    .inv{padding:10px 12px;max-width:100%}
    .head{flex-direction:column;gap:6px}
    .inv-meta{text-align:start}
    .grid2{flex-direction:column;gap:6px}
    th.n,td.n,th.u,td.u{display:none}
    table{font-size:11.5px}
    th{padding:5px 4px}
    td{padding:5px 4px}
    .c{width:auto}
    .e{width:auto}
    .thanks{display:none}
    ` : ''}
  `;
}
