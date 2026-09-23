// Contact-form notifications, sent through ZeptoMail's REST API (not SMTP - ZeptoMail's SMTP
// password is only ever shown masked in their dashboard, with no way to copy the real value, so
// the API token (shown in full, under the "API" tab of the Mail Agent) is what this uses instead).
// Docs: https://www.zoho.com/zeptomail/help/api/email-sending.html
const ZEPTOMAIL_API = 'https://api.zeptomail.eu/v1.1/email'; // .eu cluster - matches the domain's DNS setup

async function sendContactNotification(submission) {
  const token = process.env.ZEPTOMAIL_TOKEN;
  const to = process.env.NOTIFY_TO;
  if (!token || !to) {
    console.warn('ZEPTOMAIL_TOKEN / NOTIFY_TO not configured — skipping email notification. See .env.example.');
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
    const res = await fetch(ZEPTOMAIL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Zoho-enczapikey ${token}`,
      },
      body: JSON.stringify({
        from: { address: process.env.NOTIFY_FROM || `noreply@${process.env.NOTIFY_DOMAIN || 'bulgariapropertyconcierge.com'}` },
        to: [{ email_address: { address: to } }],
        reply_to: [{ address: submission.email, name: submission.name }],
        subject: `New consultation request — ${submission.name}`,
        textbody: lines.join('\n'),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ZeptoMail ${res.status}: ${body.slice(0, 300)}`);
    }
    return { sent: true };
  } catch (err) {
    console.error('Failed to send contact notification email:', err.message);
    return { sent: false, reason: 'send_failed', error: err.message };
  }
}

module.exports = { sendContactNotification };
