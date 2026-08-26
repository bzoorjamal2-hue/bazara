import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Seo from '../components/Seo.jsx';
import Logo from '../components/Logo.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { ForwardIcon } from '../components/icons.jsx';

// صفحة سياسة الخصوصية — مطلوبة لنشر تطبيق Meta ولمراجعته (App Review).
// ثنائية اللغة (عربي + إنجليزي) في نفس الصفحة ليقرأها المستخدم ومراجع Meta معاً.
export default function PrivacyPolicy() {
  const { t } = useTranslation();
  return (
    <div className="bz-docpage">
      <Seo title="سياسة الخصوصية — Bazara" />

      {/* شريط صفحة المنصّة نفسه: الصفحة تُفتح من فوتر الواجهة، فشريطُ التسوّق
          (سلّة ومفضّلة وحساب) لا معنى له هنا ويقطع الإحساس بأنّها الموقع نفسه. */}
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
        <h1 className="bz-doc-h1 font-display text-3xl font-extrabold">سياسة الخصوصية</h1>
        <p className="bz-doc-meta text-xs">آخر تحديث: 10 آب 2026</p>

        <p className="leading-relaxed">
          تشرح هذه السياسة كيف تجمع منصّة <b>Bazara</b> (بازارا) — سوق إلكتروني للأزياء يضمّ عدّة متاجر —
          البيانات وتستخدمها وتحميها، بما في ذلك البيانات المرتبطة بربط حسابات إنستغرام للمتاجر.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">البيانات التي نجمعها</h2>
        <ul className="list-disc space-y-1 pe-5 leading-relaxed">
          <li>بيانات الحساب: الاسم والبريد الإلكتروني ورقم الهاتف لأصحاب المتاجر.</li>
          <li>بيانات الطلبات: اسم الزبون وهاتفه وعنوان التوصيل والمنتجات المطلوبة.</li>
          <li>
            <b>بيانات إنستغرام (عند ربط المتجر حسابه اختيارياً):</b> محتوى الرسائل الخاصة (DM) التي تصل حساب
            المتجر، واسم/معرّف المُرسِل — وذلك فقط لعرضها لصاحب المتجر داخل لوحته والردّ عليها أو تحويلها لطلب.
          </li>
        </ul>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">كيف نستخدم البيانات</h2>
        <ul className="list-disc space-y-1 pe-5 leading-relaxed">
          <li>إدارة المتاجر والطلبات وتوصيلها.</li>
          <li>عرض رسائل إنستغرام لصاحب المتجر داخل صندوق موحّد، وتمكينه من الردّ عليها وتحويلها إلى طلبات.</li>
          <li>لا نبيع بياناتك ولا نشاركها مع أطراف ثالثة لأغراض إعلانية.</li>
        </ul>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">حفظ البيانات وحذفها</h2>
        <p className="leading-relaxed">
          يستطيع صاحب المتجر فصل حساب إنستغرام في أي وقت من لوحته، وعندها نتوقف عن استقبال رسائله ونحذف رموز
          الوصول المخزّنة. لطلب حذف بياناتك بالكامل، راسلنا على البريد أدناه وسننفّذ الطلب خلال مدة معقولة.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">الأمان</h2>
        <p className="leading-relaxed">
          نخزّن رموز الوصول مشفّرة، ونستخدم اتصالات آمنة (HTTPS)، ونقصر الوصول إلى رسائل كل متجر على صاحبه فقط.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">التواصل</h2>
        <p className="leading-relaxed">
          لأي استفسار حول الخصوصية أو لطلب حذف البيانات: <span dir="ltr">bzoorjamal2@gmail.com</span>
        </p>
      </section>

      <hr className="my-10 border-stone-300/40" />

      {/* ═════════ English ═════════ */}
      <section dir="ltr" className="bz-doc space-y-4">
        <h1 className="bz-doc-h1 font-display text-3xl font-extrabold">Privacy Policy</h1>
        <p className="bz-doc-meta text-xs">Last updated: August 10, 2026</p>

        <p className="leading-relaxed">
          This policy explains how <b>Bazara</b> — an online fashion marketplace hosting multiple independent
          stores — collects, uses, and protects data, including data related to connecting a store&apos;s
          Instagram account.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Data we collect</h2>
        <ul className="list-disc space-y-1 ps-5 leading-relaxed">
          <li>Account data: store owners&apos; name, email, and phone number.</li>
          <li>Order data: customer name, phone, delivery address, and ordered products.</li>
          <li>
            <b>Instagram data (only when a store optionally connects its account):</b> the content of Direct
            Messages sent to the store&apos;s account and the sender&apos;s name/ID — used solely to display
            them to the store owner in their dashboard so they can reply or convert a chat into an order.
          </li>
        </ul>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">How we use data</h2>
        <ul className="list-disc space-y-1 ps-5 leading-relaxed">
          <li>To manage stores, orders, and deliveries.</li>
          <li>To show Instagram messages to the store owner in a unified inbox and let them reply or create orders.</li>
          <li>We do not sell your data or share it with third parties for advertising.</li>
        </ul>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Data retention &amp; deletion</h2>
        <p className="leading-relaxed">
          A store owner can disconnect their Instagram account at any time from their dashboard; we then stop
          receiving their messages and delete the stored access tokens. To request full deletion of your data,
          email us at the address below and we will process it within a reasonable period.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Security</h2>
        <p className="leading-relaxed">
          Access tokens are stored encrypted, connections use HTTPS, and each store&apos;s messages are
          accessible only to that store&apos;s owner.
        </p>

        <h2 className="bz-doc-h2 pt-2 text-lg font-bold">Contact</h2>
        <p className="leading-relaxed">
          For privacy questions or data-deletion requests: bzoorjamal2@gmail.com
        </p>
      </section>
      </div>
    </div>
  );
}
