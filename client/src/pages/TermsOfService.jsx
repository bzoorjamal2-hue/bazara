import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';
import Logo from '../components/Logo.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { ForwardIcon } from '../components/icons.jsx';

// شروط الاستخدام — مطلوبة لنشر تطبيق Meta ولمراجعته (App Review)، وكان حقلُ
// Terms of Service URL في لوحة Meta مؤشّراً على facebook.com لغيابِ هذه الصفحة.
// ثنائية اللغة في صفحة واحدة كسياسة الخصوصية: يقرأها التاجرُ ومراجعُ Meta معاً.
export default function TermsOfService() {
  const { t } = useTranslation();
  return (
    <div className="bz-docpage">
      <Seo title="شروط الاستخدام" />

      {/* شريط صفحة المنصّة نفسه (لا شريط التسوّق) — كما في صفحة الخصوصية */}
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
        <h1 className="bz-doc-h1 font-display text-3xl font-extrabold">شروط الاستخدام</h1>
        <p className="bz-doc-meta text-xs">آخر تحديث: 10 أيلول 2026</p>

        <p className="leading-relaxed">
          باستخدامك منصّة <b>Bazara</b> (بازارا) — سوق إلكتروني للأزياء يضمّ متاجر مستقلّة — فإنّك توافق على
          الشروط أدناه. إن كنت لا توافق عليها، فالرجاء عدم استخدام المنصّة.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">طبيعة الخدمة</h2>
        <p className="leading-relaxed">
          بازارا منصّة تتيح لأصحاب المتاجر إنشاء متجر إلكتروني وعرض منتجاتهم وإدارة طلباتهم. المنصّة وسيط
          تقني: البضاعة وأوصافها وأسعارها وتوفّرها وجودتها مسؤولية صاحب المتجر وحده، والعقد على أي طلب يقوم
          بين الزبون وصاحب المتجر لا بيننا.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">الحساب</h2>
        <ul className="list-disc space-y-1 pe-5 leading-relaxed">
          <li>تلتزم بتقديم بيانات صحيحة عند التسجيل، وبتحديثها إن تغيّرت.</li>
          <li>أنت مسؤول عن سرّية كلمة المرور وعن كل نشاط يجري عبر حسابك.</li>
          <li>الحساب شخصي لصاحب المتجر، ولا يجوز بيعه أو نقله لغيره دون إذننا.</li>
        </ul>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">الاشتراك والدفع</h2>
        <ul className="list-disc space-y-1 pe-5 leading-relaxed">
          <li>فتح المتجر ونشره يتطلّب اشتراكاً سارياً (شهري أو سنوي) بالشيكل الإسرائيلي (ILS).</li>
          <li>يُدفع الاشتراك مقدّماً عن المدّة المختارة، ويبقى المتجر ظاهراً ما دام الاشتراك سارياً.</li>
          <li>عند انتهاء المدّة دون تجديد يتوقّف عرض المتجر للزبائن، وتبقى بياناتك محفوظة مدّةً معقولة.</li>
          <li>لك أن توقف التجديد متى شئت؛ ولا تُستردّ المبالغ عن مدّة بدأت فعلاً إلّا إن نصّ القانون على غير ذلك.</li>
        </ul>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">التزامات صاحب المتجر</h2>
        <ul className="list-disc space-y-1 pe-5 leading-relaxed">
          <li>أن يعرض منتجات حقيقية يملك حقّ بيعها، بوصفٍ وسعرٍ صادقين.</li>
          <li>أن يلتزم بما يعِد به الزبون من توفّر وتوصيل ومواعيد.</li>
          <li>أن يحترم قوانين التجارة والضريبة السارية في بلده.</li>
          <li>أن يتعامل مع بيانات زبائنه بسرّية ولغرض الطلب وحده.</li>
        </ul>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">المحتوى الممنوع</h2>
        <p className="leading-relaxed">
          يُمنع نشر أي محتوى مخالف للقانون، أو مسروق، أو منتحل لعلامة تجارية أو صور غيرك، أو مقلَّد يُعرض على
          أنّه أصلي، أو يحرّض على الكراهية، أو يخالف الآداب العامّة. ويُمنع بيع ما يحظره القانون.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">ربط حسابات إنستغرام</h2>
        <p className="leading-relaxed">
          يستطيع صاحب المتجر — اختيارياً — ربط حساب إنستغرام Business الخاص به ليصله ما يرده من رسائل خاصّة
          داخل لوحته ويردّ عليها. الربط يتمّ بموافقتك الصريحة عبر تسجيل الدخول لدى Meta، ويمكنك فصله في أي
          وقت من لوحتك. استخدامك لهذه الميزة يخضع أيضاً لشروط Meta وسياساتها، وتفاصيل ما نجمعه ونحذفه
          مشروحة في <Link to="/privacy" className="underline">سياسة الخصوصية</Link>.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">الملكية الفكرية</h2>
        <p className="leading-relaxed">
          اسم المنصّة وشعارها وتصميمها وبرمجيّاتها ملك لبازارا. أمّا ما ترفعه أنت من صور ونصوص فيبقى ملكك،
          وتمنحنا بنشره ترخيصاً غير حصري لعرضه داخل المنصّة ولأغراض التعريف بمتجرك عليها.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">إيقاف الخدمة</h2>
        <p className="leading-relaxed">
          يحقّ لنا إيقاف متجر أو حساب — مؤقّتاً أو نهائياً — عند مخالفة هذه الشروط أو عند ورود شكاوى جدّية
          من زبائن، ونُشعرك بالسبب ونمنحك فرصة التصحيح ما لم تكن المخالفة جسيمة أو مخالفة للقانون.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">حدود المسؤولية</h2>
        <p className="leading-relaxed">
          تُقدَّم المنصّة «كما هي». لا نضمن استمرار الخدمة بلا انقطاع أو خلوّها من الأخطاء، ولا نتحمّل
          مسؤولية الأضرار غير المباشرة أو فوات الربح. ولا نتحمّل مسؤولية نزاع بين زبون وصاحب متجر حول بضاعة
          أو توصيل، ونساعد في التوفيق قدر الإمكان.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">تعديل الشروط</h2>
        <p className="leading-relaxed">
          قد نُحدّث هذه الشروط، ويظهر تاريخ آخر تحديث أعلى الصفحة. استمرارك في استخدام المنصّة بعد التحديث
          يعني قبولك النسخة الجديدة.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">القانون الحاكم</h2>
        <p className="leading-relaxed">
          تخضع هذه الشروط للقوانين السارية في فلسطين، وتُنظر أي منازعة أمام المحاكم المختصّة فيها.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">التواصل</h2>
        <p className="leading-relaxed">
          لأي استفسار حول هذه الشروط: <span dir="ltr">bzoorjamal2@gmail.com</span>
        </p>
      </section>

      <hr className="my-10 border-stone-300/40" />

      {/* ═════════ English ═════════ */}
      <section dir="ltr" className="bz-doc space-y-4">
        <h1 className="bz-doc-h1 font-display text-3xl font-extrabold">Terms of Service</h1>
        <p className="bz-doc-meta text-xs">Last updated: September 10, 2026</p>

        <p className="leading-relaxed">
          By using <b>Bazara</b> — an online fashion marketplace hosting independent stores — you agree to the
          terms below. If you do not agree, please do not use the platform.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Nature of the service</h2>
        <p className="leading-relaxed">
          Bazara lets store owners create an online store, list products, and manage orders. The platform is a
          technical intermediary: goods, their descriptions, prices, availability, and quality are the sole
          responsibility of the store owner, and any order forms a contract between the customer and that
          store owner — not with us.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Your account</h2>
        <ul className="list-disc space-y-1 ps-5 leading-relaxed">
          <li>You agree to provide accurate registration details and keep them up to date.</li>
          <li>You are responsible for keeping your password confidential and for all activity on your account.</li>
          <li>Accounts are personal to the store owner and may not be sold or transferred without our consent.</li>
        </ul>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Subscription &amp; payment</h2>
        <ul className="list-disc space-y-1 ps-5 leading-relaxed">
          <li>Publishing a store requires an active subscription (monthly or yearly) billed in Israeli Shekels (ILS).</li>
          <li>Subscriptions are paid in advance for the chosen period; your store stays visible while it is active.</li>
          <li>If a period ends without renewal, the store stops being shown to customers and your data is retained for a reasonable time.</li>
          <li>You may stop renewal at any time. Fees for a period already started are non-refundable unless the law requires otherwise.</li>
        </ul>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Store owner obligations</h2>
        <ul className="list-disc space-y-1 ps-5 leading-relaxed">
          <li>List genuine products you have the right to sell, with truthful descriptions and prices.</li>
          <li>Honour what you promise customers regarding availability, delivery, and timing.</li>
          <li>Comply with the commercial and tax laws that apply to you.</li>
          <li>Treat customer data confidentially and use it only to fulfil the order.</li>
        </ul>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Prohibited content</h2>
        <p className="leading-relaxed">
          You may not post unlawful content, stolen material, content impersonating a brand or using someone
          else&apos;s photos, counterfeits presented as genuine, hate speech, or content offending public
          decency. Selling anything prohibited by law is not allowed.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Connecting Instagram accounts</h2>
        <p className="leading-relaxed">
          A store owner may optionally connect their own Instagram Business account so incoming Direct
          Messages appear in their dashboard and can be answered there. Connecting requires your explicit
          consent through Meta&apos;s login, and you can disconnect at any time from your dashboard. Use of
          this feature is also subject to Meta&apos;s terms and policies; what we collect and delete is
          described in our <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Intellectual property</h2>
        <p className="leading-relaxed">
          The Bazara name, logo, design, and software belong to Bazara. Images and text you upload remain
          yours; by posting them you grant us a non-exclusive licence to display them within the platform and
          to promote your store on it.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Suspension</h2>
        <p className="leading-relaxed">
          We may suspend or terminate a store or account for breach of these terms or upon serious customer
          complaints. We will tell you why and give you a chance to fix it, unless the breach is severe or
          unlawful.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Limitation of liability</h2>
        <p className="leading-relaxed">
          The platform is provided &quot;as is&quot;. We do not warrant uninterrupted or error-free service,
          and we are not liable for indirect damages or lost profits. We are not a party to disputes between a
          customer and a store owner over goods or delivery, though we help mediate where we can.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Changes to these terms</h2>
        <p className="leading-relaxed">
          We may update these terms; the last-updated date appears at the top of this page. Continuing to use
          the platform after an update means you accept the new version.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Governing law</h2>
        <p className="leading-relaxed">
          These terms are governed by the laws in force in Palestine, and any dispute falls to its competent
          courts.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Contact</h2>
        <p className="leading-relaxed">
          For questions about these terms: bzoorjamal2@gmail.com
        </p>
      </section>
      </div>
    </div>
  );
}
