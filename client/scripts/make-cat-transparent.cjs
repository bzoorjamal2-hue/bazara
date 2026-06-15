// يحوّل صور الفئات (JPG بخلفية بيضاء) إلى PNG شفّافة:
// يصغّرها لعرض معقول (أسرع تحميل) ويجعل البكسلات شبه البيضاء شفّافة، مع تنعيم الحواف.
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');

const DIR = path.join(__dirname, '..', 'public', 'categories');
const KEYS = ['abaya', 'set', 'dress', 'hijab', 'trench', 'jacket', 'shirt'];

(async () => {
  for (const key of KEYS) {
    const src = path.join(DIR, `${key}.jpg`);
    if (!fs.existsSync(src)) { console.log('skip (missing):', key); continue; }
    const img = await Jimp.read(src);
    img.scaleToFit(440, 440); // حجم كافٍ للعرض، أخف وأسرع
    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      const m = Math.min(r, g, b);
      // أبيض صريح → شفّاف؛ منطقة الحافة (شبه أبيض) → شفافية متدرّجة؛ الكريمي يبقى
      if (m >= 250) {
        this.bitmap.data[idx + 3] = 0;
      } else if (m >= 236) {
        this.bitmap.data[idx + 3] = Math.round(((250 - m) / 14) * 255);
      }
    });
    const out = path.join(DIR, `${key}.png`);
    await img.writeAsync(out);
    console.log('done:', key, `${img.bitmap.width}x${img.bitmap.height}`);
  }
  console.log('✅ كل الصور تحوّلت لـPNG شفّافة.');
})().catch((e) => { console.error(e); process.exit(1); });
