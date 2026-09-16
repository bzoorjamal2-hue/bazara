import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { searchPath } from '../utils/links.js';
import { cldThumb, cldSrcSet } from '../utils/cloudinary.js';

// شريطٌ تحريريٌّ عريض: صورةٌ واحدةٌ بعرضِ الشاشةِ بينَ قسمَين، عليها جملةٌ وزرّ.
//
// لماذا: الصفحةُ كانت رأسَ قسمٍ ثمّ قطعاً، مرّةً بعدَ مرّة — لا شيءَ يقولُ
// للعينِ أين محطّةٌ تستحقُّ الوقوف. الشريطُ يكسرُ الصفَّ ويُعطي المتجرَ صوتاً
// بدلَ أن يكونَ رفَّ بضاعة.
//
// مصدرُه: «المجموعات» نفسُها التي تُحرَّرُ أصلاً — صورةٌ وعنوانٌ وكلمةُ بحث.
// لا حقلَ جديدٌ يُملأُ من الصفر: المجموعةُ المعلَّمةُ ‎wide تُعرَضُ شريطاً،
// وغيرُها يبقى بلاطةً بالصفّ.
//
// الوجهةُ تُبنى هنا لا تُقرأُ من اللوحة: لا نقبلُ رابطاً حرّاً من الإدارةِ ولا
// من التاجرة — نبني ‎/search من كلمةِ البحثِ فلا يمكنُ حقنُ رابطٍ خارجيّ.
export default function EditorialBand({ collection, storeSlug = '' }) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const c = collection;
  // بلا صورةٍ لا شريط: العنوانُ وحدَه فوقَ فراغٍ أسوأُ من غيابِ القسم.
  if (!c || !c.image || !c.title || !c.q) return null;

  const title = (isEn ? (c.titleEn || c.title) : c.title) || '';
  const dim = Math.min(90, Math.max(0, Number.isFinite(Number(c.dim)) ? Number(c.dim) : 50)) / 100;

  return (
    <section className="bz-eband bz-sec-gap">
      <Link to={searchPath(storeSlug, c.q)} className="bz-eband-link">
        <img
          src={cldThumb(c.image, 1800)}
          srcSet={cldSrcSet(c.image, [700, 1100, 1500, 1800])}
          sizes="100vw"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="bz-eband-img"
          // التعتيمُ مخبوزٌ بالصورةِ لا طبقةً فوقَها — نفسُ سببِ الهيرو:
          // الطبقةُ فوقَ وسيطٍ مُسرَّعٍ قد يخترقُها، والرقمُ من لوحةِ صاحبِ الصفحة.
          // والمعامِلُ ٠٫٤٢ لا ٠٫٧: صارَ خلفَ النصِّ حجابٌ اتّجاهيٌّ يحملُ عبءَ
          // القراءةِ (‏.bz-eband-link::before)، فلو بقيَ التعتيمُ العامُّ على شدّتِه
          // لاجتمعا على الصورةِ فأطفآها. يبقى الرقمُ بيدِ صاحبِ الصفحةِ كما كان.
          style={{ filter: `brightness(${(1 - dim * 0.42).toFixed(3)})` }}
        />
        <div className="bz-eband-text">
          {c.eyebrow ? <span className="bz-eband-eyebrow">{c.eyebrow}</span> : null}
          <h2 className="bz-eband-h font-display">{title}</h2>
          {c.desc ? <p className="bz-eband-p">{c.desc}</p> : null}
          <span className="bz-eband-btn">{t('store.viewAll')}</span>
        </div>
      </Link>
    </section>
  );
}
