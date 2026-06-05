import nodemailer from 'nodemailer';

// إرسال البريد عبر Gmail SMTP (يُفعّل عند ضبط EMAIL_USER و EMAIL_PASS).
let transporter = null;

export function isMailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isMailConfigured()) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return transporter;
}

export async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) throw new Error('mail-not-configured');
  await t.sendMail({
    from: `Bazara <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}
