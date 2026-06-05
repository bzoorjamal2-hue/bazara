import nodemailer from 'nodemailer';

// إرسال البريد عبر SMTP عام (Brevo مثلاً) أو Gmail.
// يُفعّل عند ضبط EMAIL_USER و EMAIL_PASS (مع EMAIL_HOST للخدمات العامة).
let transporter = null;

export function isMailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isMailConfigured()) return null;

  if (process.env.EMAIL_HOST) {
    // خدمة SMTP عامة مثل Brevo
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false, // STARTTLS على 587
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  } else {
    // Gmail
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) throw new Error('mail-not-configured');
  // المُرسِل: EMAIL_FROM إن وُجد (مطلوب لبعض الخدمات)، وإلا EMAIL_USER
  const from = process.env.EMAIL_FROM || `Bazara <${process.env.EMAIL_USER}>`;
  await t.sendMail({ from, to, subject, html });
}
