import nodemailer from 'nodemailer';

// إرسالُ البريدِ عبرَ Resend (المزوّدُ الأوّل)، ثمّ Brevo، ثمّ SMTP.
//
// لماذا تبدّل المزوّد: كانت رسائلُ المنصّةِ تخرجُ من عنوانِ الإرسالِ المشتركِ
// لخطّةِ Brevo المجّانيّة ‎(77.32.148.23)، وهو مدرَجٌ بقائمةِ Hostkarma السوداء.
// وجيميل كان يرفضُ استلامَها بصمتٍ تامّ: لا ارتداد، ولا مجلّدَ سبام، ولا حتّى
// حدثُ Delivered بسجلِّ Brevo — بينما وصلت نفسُ الرسالةِ لمُختبِرِ السبامِ فوراً.
// أي أنّ المشكلةَ لم تكن بالتوثيقِ (DKIM وSPF سليمان ومتحقَّقان) ولا بالمحتوى،
// بل بسمعةِ عنوانٍ لا نملكُه ولا نملكُ إصلاحَه. وضياعُ رسالةِ رمزِ التحقّقِ يعني
// تاجرةً لا تستطيعُ دخولَ حسابِها — فالعلاجُ تبديلُ المزوّدِ لا ترقيعُ الرسالة.
//
// الترتيبُ سقوطيٌّ عمداً: إن فشل Resend ووُجد مفتاحُ Brevo جُرّب بعدَه، فلا تضيعُ
// رسالةٌ أثناءَ الانتقالِ أو عندَ عطلٍ مؤقّتٍ عندَ أحدِ المزوّدَين — والفشلُ
// الأوّلُ يُسجَّلُ دائماً كي لا يختبئَ خطأُ إعدادٍ خلفَ نجاحِ البديل.

export function isMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
    || Boolean(process.env.BREVO_API_KEY)
    || Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function parseSender() {
  const from = process.env.EMAIL_FROM || `Bazara <${process.env.EMAIL_USER || 'no-reply@bazara.app'}>`;
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || 'Bazara', email: m[2] };
  return { name: 'Bazara', email: from.trim() };
}

// نسخةٌ نصّيّةٌ من الـHTML: العناوينُ والفقراتُ تصيرُ أسطراً، والوسومُ تُنزَع،
// والكياناتُ تُفكّ. ليست تنسيقاً جميلاً — هي ما يقرؤهُ قارئُ البريدِ النصّيُّ
// وما يفحصُه مصفّي السبام، فيكفي أن تكونَ مقروءةً ومطابقةً للمحتوى.
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim();
}

// إرسال عبر Resend
async function sendViaResend({ to, subject, html }) {
  const s = parseSender();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${s.name} <${s.email}>`,
      to: [to],
      subject,
      html,
      text: htmlToText(html),
      reply_to: s.email,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`resend ${res.status}: ${t}`);
  }
}

// إرسال عبر Brevo API
async function sendViaApi({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseSender(),
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: htmlToText(html),
      // الردُّ يذهبُ لبريدِ الدعمِ لا لعنوانِ الإرسالِ التقنيّ
      replyTo: parseSender(),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`brevo-api ${res.status}: ${t}`);
  }
}

// إرسال عبر SMTP (احتياطي)
let transporter = null;
async function sendViaSmtp({ to, subject, html }) {
  if (!transporter) {
    transporter = process.env.EMAIL_HOST
      ? nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT) || 587,
          secure: false,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        })
      : nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
  }
  const from = process.env.EMAIL_FROM || `Bazara <${process.env.EMAIL_USER}>`;
  await transporter.sendMail({ from, replyTo: parseSender().email, to, subject, html, text: htmlToText(html) });
}

export async function sendMail(opts) {
  if (!isMailConfigured()) throw new Error('mail-not-configured');

  if (process.env.RESEND_API_KEY) {
    try {
      return await sendViaResend(opts);
    } catch (err) {
      // يُسجَّلُ دائماً: نجاحُ البديلِ لا يجوزُ أن يُخفيَ مفتاحاً خاطئاً أو نطاقاً
      // غيرَ موثَّقٍ عندَ Resend — وإلّا بقينا على المزوّدِ القديمِ بلا أن ندري.
      console.error('resend failed, falling back:', err.message);
      if (!process.env.BREVO_API_KEY && !(process.env.EMAIL_USER && process.env.EMAIL_PASS)) throw err;
    }
  }

  if (process.env.BREVO_API_KEY) return sendViaApi(opts);
  return sendViaSmtp(opts);
}
