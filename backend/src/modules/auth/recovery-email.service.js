const nodemailer = require("nodemailer");

function smtpConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function isConfigured() {
  return resendConfigured() || smtpConfigured();
}

function emailContent(link) {
  return {
    subject: "Crie uma nova senha no PostFan",
    text: `Recebemos uma solicitação para redefinir sua senha. Abra este link em até 1 hora: ${link}\n\nSe você não fez essa solicitação, ignore este email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#172033">
        <div style="font-size:26px;font-weight:800;color:#5145e5;margin-bottom:24px">PostFan</div>
        <h1 style="font-size:24px">Crie uma nova senha</h1>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
        <p style="margin:28px 0">
          <a href="${link}" style="background:#5145e5;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700">Criar nova senha</a>
        </p>
        <p>O link é válido por 1 hora e funciona apenas uma vez.</p>
        <p style="color:#667085;font-size:13px">Se você não fez essa solicitação, ignore este email.</p>
      </div>`,
  };
}

async function sendWithResend(to, content) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const error = new Error(`Resend recusou o envio (${response.status}).`);
    error.code = "ERESEND";
    throw error;
  }
}

async function sendWithSmtp(to, content) {
  const port = Number(process.env.EMAIL_PORT || 587);
  const secure = process.env.EMAIL_SECURE === "true" || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port,
    secure,
    requireTLS: !secure,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"PostFan" <${process.env.EMAIL_USER}>`,
      to,
      ...content,
    });
  } finally {
    transporter.close();
  }
}

async function sendRecoveryEmail(to, link) {
  const content = emailContent(link);
  if (resendConfigured()) return sendWithResend(to, content);
  if (smtpConfigured()) return sendWithSmtp(to, content);
  const error = new Error("Serviço de email não configurado.");
  error.code = "EMAIL_NOT_CONFIGURED";
  throw error;
}

module.exports = { emailContent, isConfigured, sendRecoveryEmail };
