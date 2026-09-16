// كاتب ملفات Excel (.xlsx) بلا أي مكتبة خارجية.
//
// لماذا لا CSV؟ الـCSV نصّ خام: بلا عناوين منسّقة ولا عرض أعمدة ولا تصفية ولا
// أوراق متعدّدة، وExcel قد يُفسد الأرقام والعربية. الملف هنا xlsx حقيقي يفتحه
// Excel وGoogle Sheets وNumbers بجدول منسّق جاهز — ويكبر تلقائياً مع الصفوف.
//
// كيف؟ ملف xlsx هو أرشيف ZIP يضمّ ملفات XML. نبني الـXML يدوياً، ونحزمه بطريقة
// التخزين (store) بلا ضغط — وهي طريقة صالحة تماماً بمواصفة ZIP فلا نحتاج مكتبة ضغط.

// ── ZIP (طريقة التخزين، بلا ضغط) ─────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// يبني أرشيف ZIP من [{ name, data: Uint8Array }]
function zip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const num = (n, bytes) => {
    const a = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) a[i] = (n >>> (i * 8)) & 0xff;
    return a;
  };
  const push = (arr) => { chunks.push(arr); offset += arr.length; };

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const localOffset = offset;

    // ترويسة الملف المحلّي
    push(num(0x04034b50, 4));           // التوقيع
    push(num(20, 2));                    // أدنى إصدار
    push(num(0x0800, 2));                // علم: الأسماء بترميز UTF-8
    push(num(0, 2));                     // الطريقة: تخزين بلا ضغط
    push(num(0, 2)); push(num(0, 2));    // الوقت/التاريخ (غير مهمّين)
    push(num(crc, 4));
    push(num(f.data.length, 4));         // الحجم المضغوط = الأصلي (بلا ضغط)
    push(num(f.data.length, 4));
    push(num(nameBytes.length, 2));
    push(num(0, 2));                     // بلا حقول إضافية
    push(nameBytes);
    push(f.data);

    // مدخل الفهرس المركزي (يُكتب بعد كل الملفات)
    const c = [];
    c.push(num(0x02014b50, 4), num(20, 2), num(20, 2), num(0x0800, 2), num(0, 2), num(0, 2), num(0, 2),
      num(crc, 4), num(f.data.length, 4), num(f.data.length, 4), num(nameBytes.length, 2),
      num(0, 2), num(0, 2), num(0, 2), num(0, 2), num(0, 4), num(localOffset, 4), nameBytes);
    central.push(c);
  }

  const centralStart = offset;
  for (const c of central) for (const part of c) push(part);
  const centralSize = offset - centralStart;

  // نهاية الفهرس المركزي (٢٢ بايت) — تُكتب جزءاً جزءاً: push تأخذ مصفوفة واحدة
  [num(0x06054b50, 4), num(0, 2), num(0, 2), num(files.length, 2), num(files.length, 2),
    num(centralSize, 4), num(centralStart, 4), num(0, 2)].forEach(push);

  const out = new Uint8Array(offset);
  let p = 0;
  for (const ch of chunks) { out.set(ch, p); p += ch.length; }
  return out;
}

// ── بناء XML ─────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
// حرف العمود من رقمه: 0→A، 26→AA …
const colName = (n) => { let s = ''; n += 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
// اسم الورقة بقيود Excel: ٣١ حرفاً كحدّ أقصى وبلا : \ / ? * [ ] — وإلا رفض الملف
const safeSheetName = (name, i) => (String(name || `Sheet${i + 1}`).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || `Sheet${i + 1}`);

// أنماط الخلايا — الفهارس مستعملة برقمها داخل sheetXml، فلا يُعاد ترتيبها:
//   0 نصّ · 1 ترويسة · 2 عملة · 3 عدد · 4 تاريخ · 5 وقت وتاريخ
//   6..11 نفسها بتظليل الصفّ المتناوب
//   12 مجموع نصّ · 13 مجموع عملة · 14 مجموع عدد
//   15 حالة خضراء · 16 حالة حمراء · 17 حالة كهرمانيّة
const INK = 'FF1F1E1D';
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3">
<numFmt numFmtId="164" formatCode="&quot;₪&quot;#,##0.00"/>
<numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd"/>
<numFmt numFmtId="166" formatCode="yyyy\\-mm\\-dd\\ hh:mm"/>
</numFmts>
<fonts count="5">
<font><sz val="11"/><color rgb="FF2B2A29"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="${INK}"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF1F7A4D"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFB42318"/><name val="Calibri"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${INK}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF7F6F4"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDEDEC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEAF6EF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDECEA"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFE3E2E0"/></left><right style="thin"><color rgb="FFE3E2E0"/></right><top style="thin"><color rgb="FFE3E2E0"/></top><bottom style="thin"><color rgb="FFE3E2E0"/></bottom><diagonal/></border>
<border><left style="thin"><color rgb="FFE3E2E0"/></left><right style="thin"><color rgb="FFE3E2E0"/></right><top style="medium"><color rgb="${INK}"/></top><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="18">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="166" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="164" fontId="2" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
</styleSheet>`;

// تاريخ Excel: عددُ الأيّامِ منذ ١٨٩٩-١٢-٣٠ بالتوقيتِ المحلّيّ لا UTC.
// كانت التواريخُ تُكتَبُ نصّاً ‎(toLocaleString) — فالفرزُ بعمودِ التاريخِ يصيرُ
// أبجديّاً: ‎«1/9» قبلَ ‎«8/27»، وتصفيةُ «هذا الشهر» لا تعملُ أصلاً.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
function excelDate(v) {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return (local - EXCEL_EPOCH) / 86400000;
}

// خلية واحدة: رقم → قيمة رقمية بنمط العملة/العدد، وغيرها → نصّ مضمّن
function cellXml(ref, value, style) {
  if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${style}"/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

// ورقة: { name, columns:[{header,width,type,total?}], rows:[[...]], rtl?, totalLabel? }
//   type: 'money' | 'int' | 'date' | 'datetime' | نصّ
//   total: true على عمودٍ رقميٍّ → يُضافُ صفُّ مجاميعَ أسفلَ الورقةِ بدالّةِ SUM
//          حقيقيّةٍ لا برقمٍ محسوب، فيتحدّثُ المجموعُ مع أيِّ فرزٍ أو تعديل.
function sheetXml(sheet) {
  const cols = sheet.columns || [];
  const rows = sheet.rows || [];
  const colsXml = cols.length
    ? `<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 18}" customWidth="1"/>`).join('')}</cols>`
    : '';

  // نمطُ الخليّةِ حسبَ نوعِ العمودِ وموضعِ الصفّ: التظليلُ المتناوبُ يجعلُ قراءةَ
  // سطرٍ كاملٍ عبرَ ثلاثةَ عشرَ عموداً ممكنةً بلا أن تضيعَ العينُ بينَ الأعمدة.
  const styleFor = (type, alt) => {
    const base = type === 'money' ? 2 : type === 'int' ? 3 : type === 'date' ? 4 : type === 'datetime' ? 5 : 0;
    return alt ? base + 6 : base;
  };

  let r = 1;
  const body = [];
  body.push(`<row r="${r}" ht="28" customHeight="1">${cols.map((c, i) => cellXml(`${colName(i)}${r}`, c.header, 1)).join('')}</row>`);
  const headerRow = r;
  const firstData = r + 1;

  rows.forEach((row, ri) => {
    r += 1;
    const alt = ri % 2 === 1;
    body.push(`<row r="${r}">${row.map((v, i) => {
      const c = cols[i] || {};
      // قيمةٌ بنمطٍ صريح: {v, s} — تُستعملُ لتلوينِ خليّةِ الحالة
      if (v && typeof v === 'object' && !(v instanceof Date) && 's' in v) {
        return cellXml(`${colName(i)}${r}`, v.v, v.s);
      }
      const val = (c.type === 'date' || c.type === 'datetime') ? excelDate(v) : v;
      return cellXml(`${colName(i)}${r}`, val, styleFor(c.type, alt));
    }).join('')}</row>`);
  });
  const lastData = r;

  // صفُّ المجاميع: الأرقامُ التي يهمُّ مجموعُها وحدَها، والباقي فارغٌ بنفسِ الثوب
  const totalCols = cols.map((c, i) => (c.total ? i : -1)).filter((i) => i >= 0);
  if (totalCols.length && rows.length) {
    r += 1;
    body.push(`<row r="${r}" ht="24" customHeight="1">${cols.map((c, i) => {
      const ref = `${colName(i)}${r}`;
      if (i === 0) return `<c r="${ref}" s="12" t="inlineStr"><is><t>${esc(sheet.totalLabel || 'الإجمالي')}</t></is></c>`;
      if (!c.total) return `<c r="${ref}" s="${c.type === 'money' ? 13 : 12}"/>`;
      const col = colName(i);
      const st = c.type === 'money' ? 13 : 14;
      return `<c r="${ref}" s="${st}"><f>SUM(${col}${firstData}:${col}${lastData})</f></c>`;
    }).join('')}</row>`);
  }

  const lastCol = colName(Math.max(0, cols.length - 1));
  // تجميد سطر العناوين + تصفية تلقائية عليه: تبقى العناوين ظاهرة ويمكن الفرز
  // والتصفية مهما زادت الصفوف مستقبلاً.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><outlinePr summaryBelow="1" summaryRight="1"/></sheetPr>
<sheetViews><sheetView rightToLeft="${sheet.rtl === false ? '0' : '1'}" showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="19"/>
${colsXml}
<sheetData>${body.join('')}</sheetData>
<autoFilter ref="A${headerRow}:${lastCol}${Math.max(lastData, headerRow)}"/>
</worksheet>`;
}

/**
 * ينزّل ملف xlsx حقيقي.
 * @param {Array} sheets [{ name, columns:[{header,width,type:'text'|'money'|'int'}], rows:[[..]] }]
 * @param {string} filename بلا امتداد
 */
export function downloadXlsx(sheets, filename = 'export') {
  const enc = new TextEncoder();
  const list = sheets.filter(Boolean);

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${list.map((s, i) => `<sheet name="${esc(safeSheetName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const files = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRels) },
    { name: 'xl/styles.xml', data: enc.encode(STYLES) },
    ...list.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(s)) })),
  ];

  const bytes = zip(files);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
