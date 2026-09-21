import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';
import { BAZARA_EMAIL } from '../config/site.js';
import Logo from '../components/Logo.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { ForwardIcon } from '../components/icons.jsx';

// صفحة «حذف البيانات» — عنوانٌ تطلبُه Meta صراحةً (Data Deletion Instructions URL)
// قبل أن تسمحَ بنشرِ التطبيق، ويضغطُه المستخدمُ من إعداداتِ فيسبوك.
//
// كان العنوانُ يردُّ 200 ويرسمُ صفحةَ 404، لأنّ المسارَ غيرُ موجودٍ أصلاً بالتطبيق —
// وهذا يوقفُ النشر.
//
// وما يُكتَبُ هنا يجبُ أن يطابقَ ما يفعلُه الكودُ حرفاً بحرف: الفصلُ يُلغي اشتراكَ
// الـwebhook ويمسحُ رمزَ الوصولِ ومعرّفاتِ الحساب، **ولا يحذفُ المحادثاتِ المحفوظة**
// (وهذا مقصود: تاجرةٌ تُعيدُ الربطَ تجدُ سجلَّ زبائنِها كما تركته). فحذفُ المحادثاتِ
// طلبٌ صريحٌ يُنفَّذُ بالبريد. أن نَعِدَ هنا بغيرِ ما يجري هو الكذبُ بعينِه.
export default function DataDeletion() {
  const { t } = useTranslation();
  const mail = `mailto:${BAZARA_EMAIL}?subject=${encodeURIComponent('طلب حذف بيانات — Data deletion request')}`;
  return (
    <div className="bz-docpage">
      <Seo title="حذف البيانات" />

      <header className="bz-dochead">
        <Link to="/" className="bz-nav-brand" aria-label={t('app.name')}>
          <Logo className="h-9 w-9" />
          <span className="bz-nav-name">{t('app.name')}</span>
        </Link>
        <div className="bz-nav-side">
          <Link to="/" className="bz-nav-link">{t('nav.home')}</Link>
          <Link to="/shop" className="bz-nav-cta">
            {t('landing.shopNow')} <ForwardIcon className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">

        {/* ═════════ العربية ═════════ */}
        <section dir="rtl" className="bz-doc space-y-4">
          <h1 className="bz-doc-h1 font-display text-3xl font-extrabold">حذف البيانات</h1>
          <p className="bz-doc-meta text-xs">آخر تحديث: 21 أيلول 2026</p>

          <p className="leading-relaxed">
            هذه الصفحة تشرح كيف تحذف بياناتك من منصّة بازارا، وما الذي يُحذف في كل حالة.
            تخصّ البيانات التي نحصل عليها عبر ربط حساب إنستغرام أو صفحة فيسبوك بمتجرك.
          </p>

          <h2 className="bz-doc-h2 pt-2 text-lg font-bold">١) إيقاف جمع البيانات فوراً (بنفسك)</h2>
          <p className="leading-relaxed">
            من لوحة متجرك ← تبويب «رسائل إنستغرام» ← زرّ «فصل الحساب». يجري عندها فوراً:
          </p>
          <ul className="list-disc space-y-1 ps-6 leading-relaxed">
            <li>إلغاء اشتراك تطبيقنا برسائل صفحتك، فلا تصلنا رسالة جديدة بعدها.</li>
            <li>مسح رمز الوصول (Access Token) المخزّن عندنا نهائياً.</li>
            <li>مسح معرّف حساب إنستغرام ومعرّف الصفحة المرتبطَين بمتجرك.</li>
          </ul>
          <p className="leading-relaxed">
            تبقى المحادثات التي وصلتك قبل الفصل محفوظة في صندوقك، كي تجدها إن أعدت
            الربط لاحقاً. لحذفها هي أيضاً، اتبع الخطوة التالية.
          </p>

          <h2 className="bz-doc-h2 pt-2 text-lg font-bold">٢) حذف بياناتك بالكامل</h2>
          <p className="leading-relaxed">
            راسلنا من البريد المسجَّل بحسابك على{' '}
            <a href={mail} dir="ltr" className="underline">{BAZARA_EMAIL}</a>{' '}
            واكتب «طلب حذف بيانات» مع اسم متجرك أو اسم حساب إنستغرام. نحذف خلال ٣٠ يوماً:
          </p>
          <ul className="list-disc space-y-1 ps-6 leading-relaxed">
            <li>كل المحادثات والرسائل الواردة والصادرة عبر إنستغرام أو ماسنجر.</li>
            <li>المرفقات المحفوظة (صور ومقاطع صوتية) ونسخها لدى مزوّد الوسائط.</li>
            <li>أسماء الزبائن وصورهم التي جلبناها من Meta لعرضها في صندوقك.</li>
            <li>رموز الوصول ومعرّفات الحساب والصفحة إن كانت ما تزال محفوظة.</li>
          </ul>
          <p className="leading-relaxed">
            نرسل لك تأكيداً بالبريد عند التنفيذ. ما قد يبقى بعدها هو ما يُلزمنا القانون
            بحفظه فقط — مثل سجلّات الطلبات والفواتير المطلوبة للمحاسبة، وهي لا تتضمّن
            محتوى رسائلك.
          </p>

          <h2 className="bz-doc-h2 pt-2 text-lg font-bold">٣) سحب الإذن من فيسبوك نفسه</h2>
          <p className="leading-relaxed">
            تستطيع أيضاً إزالة تطبيق بازارا من إعدادات حسابك على فيسبوك: الإعدادات ←
            «التطبيقات والمواقع» ← اختر بازارا ← «إزالة». عندها يتوقّف وصولنا لبياناتك
            من جهة Meta، ويبقى حذف ما هو محفوظ عندنا بالخطوة ٢.
          </p>

          <p className="leading-relaxed">
            تفاصيل ما نجمعه ولماذا: <Link to="/privacy" className="underline">سياسة الخصوصية</Link>.
          </p>
        </section>

        <hr className="my-10 border-stone-300/40" />

        {/* ═════════ English ═════════ */}
        <section dir="ltr" className="bz-doc space-y-4">
          <h1 className="bz-doc-h1 font-display text-3xl font-extrabold">Data Deletion</h1>
          <p className="bz-doc-meta text-xs">Last updated: 21 September 2026</p>

          <p className="leading-relaxed">
            This page explains how to delete your data from Bazara, and what is removed in each
            case. It covers data we obtain when you connect an Instagram account or Facebook Page
            to your store.
          </p>

          <h2 className="bz-doc-h2 pt-2 text-lg font-bold">1) Stop data collection now (self-service)</h2>
          <p className="leading-relaxed">
            In your store dashboard → &quot;Instagram messages&quot; tab → &quot;Disconnect&quot;. This immediately:
          </p>
          <ul className="list-disc space-y-1 ps-6 leading-relaxed">
            <li>Unsubscribes our app from your Page&apos;s messages, so no new message reaches us.</li>
            <li>Permanently erases the stored access token.</li>
            <li>Erases the Instagram account ID and Page ID linked to your store.</li>
          </ul>
          <p className="leading-relaxed">
            Conversations received before disconnecting remain in your inbox, so they are still
            there if you reconnect later. To delete those as well, use step 2.
          </p>

          <h2 className="bz-doc-h2 pt-2 text-lg font-bold">2) Delete all of your data</h2>
          <p className="leading-relaxed">
            Email us from your account address at{' '}
            <a href={mail} dir="ltr" className="underline">{BAZARA_EMAIL}</a>{' '}
            with the subject &quot;Data deletion request&quot; and your store or Instagram handle.
            Within 30 days we delete:
          </p>
          <ul className="list-disc space-y-1 ps-6 leading-relaxed">
            <li>All conversations and messages sent or received via Instagram or Messenger.</li>
            <li>Stored attachments (images and voice notes) and their copies at our media provider.</li>
            <li>Customer names and profile pictures fetched from Meta to display in your inbox.</li>
            <li>Any remaining access tokens, account IDs and Page IDs.</li>
          </ul>
          <p className="leading-relaxed">
            We confirm by email once done. Only records we are legally required to keep may
            remain — such as order and invoice records needed for accounting, which contain no
            message content.
          </p>

          <h2 className="bz-doc-h2 pt-2 text-lg font-bold">3) Revoke access from Facebook</h2>
          <p className="leading-relaxed">
            You can also remove the Bazara app from your Facebook account: Settings → &quot;Apps and
            Websites&quot; → select Bazara → &quot;Remove&quot;. That stops our access from Meta&apos;s side;
            deleting what is already stored with us is step 2.
          </p>

          <p className="leading-relaxed">
            What we collect and why: <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
