const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null; // email not configured — see .env.example

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587/25
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

async function sendContactNotification(submission) {
  const t = getTransporter();
  if (!t) {
    console.warn('SMTP not configured — skipping email notification. See .env.example.');
    return { sent: false, reason: 'not_configured' };
  }

  const lines = [
    `New inquiry from ${submission.name}`,
    '',
    `Email: ${submission.email}`,
    `Phone: ${submission.phoneCode} ${submission.phone}`,
    `Apartment type: ${submission.apartmentType}`,
    `Investment goal: ${submission.investmentGoal}`,
    `Purchase timeline: ${submission.purchaseTimeline}`,
    `Budget: ${submission.budget}`,
    `Finish tier: ${submission.finishTier}`,
    submission.message ? `\nMessage:\n${submission.message}` : '',
  ].filter(Boolean);

  try {
    await t.sendMail({
      from: process.env.NOTIFY_FROM || process.env.SMTP_USER,
      to: process.env.NOTIFY_TO || process.env.SMTP_USER,
      replyTo: submission.email,
      subject: `New consultation request — ${submission.name}`,
      text: lines.join('\n'),
    });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send contact notification email:', err.message);
    return { sent: false, reason: 'send_failed', error: err.message };
  }
}

module.exports = { sendContactNotification };
