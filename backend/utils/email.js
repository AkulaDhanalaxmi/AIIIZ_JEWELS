const { Resend } = require('resend');

function hasEmailConfig() {
  return Boolean(process.env.RESEND_API_KEY);
}

function createClient() {
  if (!hasEmailConfig()) {
    return null;
  }

  return new Resend(process.env.RESEND_API_KEY);
}

async function sendEmail({ to, subject, html, text }) {
  const resend = createClient();
  if (!resend) {
    const error = new Error('Resend API key is not configured. Set RESEND_API_KEY in the backend environment.');
    error.code = 'EMAIL_CONFIG_MISSING';
    throw error;
  }

  // Use Resend's shared test sender until you verify your own domain.
  // Once you own a domain (e.g. aiiiz.in) and verify it in Resend,
  // change this to something like 'noreply@aiiiz.in'.
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    const err = new Error(error.message || 'Failed to send email via Resend');
    err.code = 'EMAIL_SEND_FAILED';
    err.details = error;
    throw err;
  }

  return data;
}

module.exports = { sendEmail, hasEmailConfig };