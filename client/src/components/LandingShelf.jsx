import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { cldThumb, cldVideoPoster } from '../utils/cloudinary.js';
import { ForwardIcon } from '../components/icons.jsx';

// رفٌّ من قطعٍ حقيقيّة على صفحة الواجهة.
//
// كانت الصفحة تبيع منصّةَ أزياءٍ بلا أزياء: صورةُ الهيرو وحدها، ثمّ ثلاثةُ
// آلاف بكسلٍ من بطاقات نصّ. والزائرة لا ترى قطعةً ولا متجراً ولا شكلَ ما
// ستحصل عليه — وهذا أوّلُ ما تفعله مواقعُ الأزياء: تُري البضاعة.
//
// وحين قِستُ البيانات وجدتُ أنّ لا منتج من الثلاثين يحمل صورة: التاجرات يرفعن
// فيديوهات. فاللقطةُ الأولى من الفيديو هي الصورة — كلاوديناري يولّدها، وهي
// ٦٠٠×١٠٦٧ أي عموديّةٌ تماماً كما تُصوَّر الأزياء.

const posterOf = (p) => {
  const img = p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';
  if (img) return cldThumb(img, 500);
  return p.videoUrl ? cldVideoPoster(p.videoUrl, 500) : '';
};

export default function LandingShelf({ heading }) {
  const { t } = useTranslation();
  const [items, setItems] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/public/home')
      .then((r) => {
        if (!alive) return;
        const pool = [...(r.data?.featured || []), ...(r.data?.deals || []), ...(r.data?.products || [])];
        // بلا تكرار، وبلا قطعةٍ لا صورة لها ولا فيديو — الرفُّ الفارغ أسوأ من
        // غيابه، وقسمٌ ينقصه نصفُ بلاطاته يبدو معطوباً لا هادئاً.
        const seen = new Set();
        const withArt = [];
        for (const p of pool) {
          if (seen.has(p.id)) continue;
          const src = posterOf(p);
          if (!src) continue;
          seen.add(p.id);
          withArt.push({ ...p, src });
          if (withArt.length === 10) break;
        }
        setItems(withArt);
      })
      .catch(() => setItems([]));
    return () => { alive = false; };
  }, []);

  // أقلّ من أربع قطعٍ لا تصنع رفّاً — فلا نعرض القسم أصلاً
  if (!items || items.length < 4) return null;

  return (
    <section id="shelf" className="bz-sec bz-sec-light">
      <div className="mx-auto max-w-2xl text-center">
        <p className="bz-eyebrow">{heading?.eyebrow || t('landing.shelfEyebrow')}</p>
        <h2 className="bz-h2">{heading?.title || t('landing.shelfTitle')}</h2>
        <p className="bz-lead mx-auto mt-3 max-w-xl">{heading?.desc || t('landing.shelfDesc')}</p>
      </div>

      {/* شريطٌ يُسحب أفقياً: على الجوّال يمتدّ لحافّتَي الشاشة فيبدو أنّ خلفه
          مزيداً (وهو ما يدعو للسحب)، وعلى الشاشة الواسعة يتوسّط بعرضٍ محدود.
          scroll-snap يجعل السحب يستقرّ على قطعةٍ لا بين قطعتين. */}
      <div className="bz-shelf" role="list">
        {items.map((p) => (
          <Link
            key={p.id}
            to={`/product/${p.id}`}
            role="listitem"
            className="bz-shelf-item"
            aria-label={p.name}
          >
            <span className="bz-shelf-art">
              <img src={p.src} alt="" loading="lazy" decoding="async" />
            </span>
            <span className="bz-shelf-name">{p.name}</span>
            <span className="bz-shelf-price">{t('common.currency')}{p.price}</span>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link to="/shop" className="bz-act">
          {t('landing.shelfCta')} <ForwardIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
