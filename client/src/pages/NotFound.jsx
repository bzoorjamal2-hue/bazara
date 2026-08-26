import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';
import { BagIcon } from '../components/icons.jsx';
import { StateCard, Act, Act2 } from '../components/PageUI.jsx';

// 404: بطاقةُ حالةٍ كباقي حالات الموقع — أيقونة ونصّ ومخرجان، بلا زخرفة
// خاصّةٍ بها وحدها (خيطٌ علويّ، وشرطةٌ متدرّجة، ورقمٌ بتدرّجٍ ثلاثيّ).
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <Seo title="404" />
      <StateCard icon={<span className="bz-404">404</span>} text={t('errors.notFound')}>
        <Act to="/shop"><BagIcon className="h-5 w-5" /> {t('co.doneKeepShopping')}</Act>
        <Act2 to="/">{t('nav.home')}</Act2>
      </StateCard>
    </div>
  );
}
