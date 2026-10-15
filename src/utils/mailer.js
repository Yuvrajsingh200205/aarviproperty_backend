const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;
const configured = () => Boolean(env.smtp.host && env.smtp.user && env.smtp.to);

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
};

// Fire-and-forget: a mail failure must never fail the enquiry request.
async function notifyEnquiry(enquiry) {
  if (!configured() || env.isTest) return false;
  try {
    await getTransporter().sendMail({
      from: env.smtp.from || env.smtp.user,
      to: env.smtp.to,
      subject: `New ${enquiry.enquiryType}: ${enquiry.name}${enquiry.projectName ? ` – ${enquiry.projectName}` : ''}`,
      text: [
        `Name: ${enquiry.name}`,
        `Phone: ${enquiry.phone}`,
        `Email: ${enquiry.email || '-'}`,
        `Type: ${enquiry.enquiryType}`,
        `Interested in: ${enquiry.enquiryFor || enquiry.projectName || '-'}`,
        `Page: ${enquiry.pageUrl || '-'}`,
        '',
        enquiry.message || '',
      ].join('\n'),
    });
    return true;
  } catch (err) {
    console.error('Enquiry mail failed:', err.message);
    return false;
  }
}

module.exports = { notifyEnquiry };
