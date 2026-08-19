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

// أنماط الخلايا: 0 عادي · 1 ترويسة · 2 عملة · 3 عدد صحيح · 4 عنوان الملخّص
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FF3F2E22"/><name val="Calibri"/></font>
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><color rgb="FF5E4636"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD4AF37"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFE3DDD3"/></left><right style="thin"><color rgb="FFE3DDD3"/></right><top style="thin"><color rgb="FFE3DDD3"/></top><bottom style="thin"><color rgb="FFE3DDD3"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

// خلية واحدة: رقم → قيمة رقمية بنمط العملة/العدد، وغيرها → نصّ مضمّن
function cellXml(ref, value, style) {
  if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${style}"/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

// ورقة: { name, columns:[{header,width,type}], rows:[[...]], title? }
function sheetXml(sheet) {
  const cols = sheet.columns || [];
  const rows = sheet.rows || [];
  const colsXml = cols.length
    ? `<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 18}" customWidth="1"/>`).join('')}</cols>`
    : '';

  let r = 1;
  const body = [];
  body.push(`<row r="${r}" ht="26" customHeight="1">${cols.map((c, i) => cellXml(`${colName(i)}${r}`, c.header, 1)).join('')}</row>`);
  const headerRow = r;
  for (const row of rows) {
    r += 1;
    body.push(`<row r="${r}">${row.map((v, i) => {
      const type = cols[i]?.type;
      const style = type === 'money' ? 2 : type === 'int' ? 3 : 0;
      return cellXml(`${colName(i)}${r}`, v, style);
    }).join('')}</row>`);
  }
  const lastCol = colName(Math.max(0, cols.length - 1));
  // تجميد سطر العناوين + تصفية تلقائية عليه: تبقى العناوين ظاهرة ويمكن الفرز
  // والتصفية مهما زادت الصفوف مستقبلاً.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><outlinePr summaryBelow="1" summaryRight="1"/></sheetPr>
<sheetViews><sheetView rightToLeft="${sheet.rtl === false ? '0' : '1'}" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
${colsXml}
<sheetData>${body.join('')}</sheetData>
<autoFilter ref="A${headerRow}:${lastCol}${Math.max(r, headerRow)}"/>
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
