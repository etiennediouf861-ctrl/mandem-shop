const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  return transporter;
}

async function sendOrderEmails({ orderRef, customerEmail, total, paymentMethod, items }) {
  const tx = getTransporter();
  const adminEmail = process.env.ADMIN_EMAIL || '';
  if (!tx) {
    console.log('[MAIL_DISABLED]', { orderRef, customerEmail, total, paymentMethod });
    return;
  }

  const lines = items.map((it) => `- ${it.name} x${it.quantity} (${it.price} FCFA)`).join('\n');

  if (customerEmail) {
    await tx.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: customerEmail,
      subject: `Commande ${orderRef} - MANDEM SHOP`,
      text: `Merci pour votre commande ${orderRef}.\nTotal: ${total} FCFA\nPaiement: ${paymentMethod}\n\n${lines}`
    });
  }

  if (adminEmail) {
    await tx.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: adminEmail,
      subject: `Nouvelle commande ${orderRef}`,
      text: `Commande reçue.\nTotal: ${total} FCFA\nPaiement: ${paymentMethod}\n\n${lines}`
    });
  }
}

module.exports = { sendOrderEmails };
