const nodemailer = require("nodemailer");

async function main() {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  const info = await transport.sendMail({
    from: "PostFan Test <no-reply@postfan.invalid>",
    to: "recipient@postfan.invalid",
    subject: "PostFan transport test",
    text: "Mensagem local de teste. Nenhum e-mail foi enviado.",
  });

  const rendered = info.message.toString("utf8");
  if (!rendered.includes("Subject: PostFan transport test")) {
    throw new Error("O transporte local nao gerou a mensagem esperada.");
  }

  const failingTransport = nodemailer.createTransport({
    host: "127.0.0.1",
    port: 1,
    secure: false,
    connectionTimeout: 500,
    greetingTimeout: 500,
    socketTimeout: 500,
  });

  let rejected = false;
  try {
    await failingTransport.verify();
  } catch {
    rejected = true;
  } finally {
    failingTransport.close();
  }

  if (!rejected) {
    throw new Error("Uma configuracao SMTP invalida foi aceita inesperadamente.");
  }

  console.log("Email: geracao local e tratamento de falha SMTP validados.");
}

main().catch((error) => {
  console.error(`Falha no teste de email: ${error.message}`);
  process.exitCode = 1;
});
