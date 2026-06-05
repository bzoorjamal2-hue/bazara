import nodemailer from 'nodemailer';

// إرسال البريد عبر Brevo HTTP API (مفضّل — يعمل على Render لأنه HTTPS)،
// ويسقط إلى SMTP إن لم يتوفّر مفتاح الـ API.

export function isMailConfigured() {
  return Boolean(process.env.BREVO_API_KEY) || Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function parseSender() {
  const from = process.env.EMAIL_FROM || `Bazara <${process.env.EMAIL_USER || 'no-reply@bazara.app'}>`;
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || 'Bazara', email: m[2] };
  return { name: 'Bazara', email: from.trim() };
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
    body: JSON.stringify({ sender: parseSender(), to: [{ email: to }], subject, htmlContent: html }),
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
  await transporter.sendMail({ from, to, subject, html });
}

export async function sendMail(opts) {
  if (!isMailConfigured()) throw new Error('mail-not-configured');
  if (process.env.BREVO_API_KEY) return sendViaApi(opts);
  return sendViaSmtp(opts);
}
