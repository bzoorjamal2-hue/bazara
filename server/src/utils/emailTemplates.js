// قوالبُ رسائلِ البريد.
//
// كان نصُّ رسالةِ الرمزِ أربعةَ أسطرٍ قصيرة، ومصفّي السبامِ يقيسُ نسبةَ النصِّ
// إلى شيفرةِ الـHTML: فحصُ mail-tester أعطى «رسالتُك ٢٠٪ نصّ» وخصمَ عليها
// ‎1.6 نقطةٍ بقاعدةِ HTML_IMAGE_ONLY — أي أنّها بدت رسالةً دعائيّةً بصورةٍ
// وقليلِ كلام. النصُّ هنا أطولُ لأنّه يقولُ ما يجبُ أن يُقال فعلاً: ما هذا
// الرمز، وكم يدوم، ولماذا لا يُشارَك، وماذا يفعلُ من لم يطلبه — وهذه معلوماتٌ
// تخدمُ القارئةَ قبلَ أن تخدمَ المصفّي.

const FOOT = `
  <hr style="border:none;border-top:1px solid #E8E7E5;margin:22px 0">
  <p style="font-size:12px;line-height:1.9;color:#6E6C6A;margin:0">
    بازارا — منصّة متاجر الأزياء الفلسطينية<br>
    <span dir="ltr">bazarastore.site</span> · للمساعدة راسلنا على
    <a href="mailto:info@bazarastore.site" dir="ltr" style="color:#1F1E1D">info@bazarastore.site</a>
  </p>`;

// إطارٌ واحدٌ لكلِّ الرسائل: اتّجاهٌ وخطٌّ ولونُ حبرٍ وتذييلٌ موحّد
function wrap(inner) {
  return `<div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;color:#1F1E1D;font-size:15px;line-height:1.9;max-width:560px">
    ${inner}
    ${FOOT}
  </div>`;
}

/** رسالةُ رمزِ استعادةِ كلمةِ المرور (تُستعمَلُ من مسارِ الزبونةِ ومن مسارِ المدير) */
export function resetCodeEmail(code, sentAt) {
  return {
    subject: `رمز التحقق ${code} — Bazara`,
    html: wrap(`
      <h2 style="font-size:19px;margin:0 0 14px">رمز استعادة كلمة المرور</h2>
      <p style="margin:0 0 12px">
        وصلَنا طلبٌ لاستعادة كلمة المرور لحسابك في بازارا. استخدم الرمز التالي في
        الصفحة نفسها التي طلبته منها لتعيين كلمة مرور جديدة:
      </p>
      <p style="font-size:30px;font-weight:bold;letter-spacing:8px;margin:18px 0;color:#1F1E1D" dir="ltr">${code}</p>
      <p style="margin:0 0 12px">
        الرمز صالح ١٥ دقيقة فقط من وقت إرساله، ويُلغى تلقائياً أيّ رمز سابق طلبته —
        فإن طلبت أكثر من رمز، الأحدث وحده هو الذي يعمل.
      </p>
      <p style="margin:0 0 12px">
        <strong>لا تشارك هذا الرمز مع أحد.</strong> فريق بازارا لن يطلب منك رمز التحقق
        ولا كلمة المرور في أيّ رسالة أو مكالمة، ومن يطلبه منك فهو ليس منّا.
      </p>
      <p style="margin:0 0 12px">
        وإن لم تطلب استعادة كلمة المرور، تجاهل هذه الرسالة: حسابك كما هو ولم يتغيّر فيه
        شيء، والرمز ينتهي وحده بعد ربع ساعة.
      </p>
      <p style="font-size:13px;color:#6E6C6A;margin:0">أُرسلت هذه الرسالة في ${sentAt} بتوقيت فلسطين.</p>`),
  };
}

/** تنبيهُ صاحبةِ المتجرِ بطلبٍ جديد */
export function newOrderEmail({ storeName, customerName, customerPhone, city, rowsHtml, total, currency = '₪' }) {
  return {
    subject: `🛍️ طلب جديد — ${storeName}`,
    html: wrap(`
      <h2 style="font-size:19px;margin:0 0 14px">🛍️ طلب جديد في متجرك ${storeName}</h2>
      <p style="margin:0 0 12px">
        وصلك طلب جديد الآن. هذه تفاصيله، ويمكنك تأكيده ومتابعة حالته من
        <strong>لوحة التحكّم ← الطلبات</strong>:
      </p>
      <p style="margin:0 0 6px"><strong>الزبونة:</strong> ${customerName} — <span dir="ltr">${customerPhone}</span></p>
      ${city ? `<p style="margin:0 0 6px"><strong>المدينة:</strong> ${city}</p>` : ''}
      <ul style="margin:12px 0;padding-inline-start:20px">${rowsHtml}</ul>
      <p style="font-size:18px;margin:12px 0"><strong>الإجمالي: ${currency}${total}</strong></p>
      <p style="margin:0 0 12px">
        تواصلي مع الزبونة بأسرع وقت وأكّدي الطلب — التأكيد السريع أكثر ما يقلّل إلغاء الطلبات.
      </p>`),
  };
}
