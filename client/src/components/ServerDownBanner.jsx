import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client.js';
import { isServerDown, subscribeServerDown, markServerUp } from '../utils/serverState.js';

// شريطُ «الخادم واقف» — لا يختفي بعد أربع ثوانٍ كشريطِ الانقطاع، لأنّ الحالةَ
// نفسَها لا تختفي. يبقى ظاهراً ما دام الخادمُ صامتاً، ويزول وحدَه لحظةَ عودته.
//
// ولماذا شريطٌ منفصل؟ لأنّ الرسالة مختلفةٌ جذرياً: انقطاعُ الشبكة شيءٌ تفعله
// الزبونة (تتحقّق من الواي فاي)، وتوقّفُ الخادم شيءٌ لا حيلةَ لها فيه — وأسوأُ
// ما يمكن قولُه لها حينها هو «تحقّقي من اتصالك».
export default function ServerDownBanner() {
  const { t } = useTranslation();
  const down = useSyncExternalStore(subscribeServerDown, isServerDown, () => false);
  const [trying, setTrying] = useState(false);

  // نتحسّس عودتَه بهدوء كلّ نصف دقيقة، فيزول الشريطُ بلا أن تفعل شيئاً
  useEffect(() => {
    if (!down) return undefined;
    const id = setInterval(() => { api.get('/public/site-info').catch(() => {}); }, 30000);
    return () => clearInterval(id);
  }, [down]);

  if (!down) return null;

  const retry = async () => {
    setTrying(true);
    try { await api.get('/public/site-info'); markServerUp(); window.location.reload(); } catch { /* ما زال صامتاً */ }
    setTrying(false);
  };

  return (
    <div className="bz-srv" role="status" aria-live="polite">
      <span className="bz-srv-dot" aria-hidden="true" />
      <span className="bz-srv-t">{t('serverDown.message') || 'خدمة الموقع متوقّفة مؤقّتاً. اتّصالُكِ سليم — نعرض لكِ آخر نسخة محفوظة.'}</span>
      <button type="button" onClick={retry} disabled={trying} className="bz-srv-btn">
        {trying ? (t('serverDown.trying') || 'جارٍ المحاولة…') : (t('serverDown.retry') || 'أعيدي المحاولة')}
      </button>
    </div>
  );
}
