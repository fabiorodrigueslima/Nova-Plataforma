const fs = require("fs");
const net = require("net");
const path = require("path");

process.env.CLOUDINARY_CLOUD_NAME = "";
process.env.CLOUDINARY_API_KEY = "";
process.env.CLOUDINARY_API_SECRET = "";

const app = require("../server");
const pool = require("../db");
const sessionService = require("../src/modules/auth/session.service");

const uploadsDir = path.resolve(__dirname, "../uploads");
const createdFiles = new Set();

function formWith(name, content, type, extra = []) {
  const form = new FormData();
  form.append("imagem", new Blob([content], { type }), name);
  for (const file of extra) {
    form.append("imagem", new Blob([file.content], { type: file.type }), file.name);
  }
  return form;
}

async function requestUpload(baseUrl, session, form) {
  return fetch(`${baseUrl}/upload`, {
    method: "POST",
    headers: {
      Cookie: `postfan_session=${session.token}`,
      "X-CSRF-Token": session.csrfToken,
    },
    body: form,
  });
}

async function expectStatus(label, response, expected) {
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(`${label}: esperado HTTP ${expected}, recebido ${response.status}: ${body}`);
  }
}

async function recordCreatedFile(response) {
  const body = await response.json();
  if (typeof body.url === "string" && body.url.startsWith("/uploads/")) {
    createdFiles.add(path.basename(body.url));
  }
}

async function interruptMultipart(port, session) {
  await new Promise((resolve, reject) => {
    const boundary = "postfan-interrupted-test";
    const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
      const prefix =
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="imagem"; filename="partial.png"\r\n' +
        "Content-Type: image/png\r\n\r\n";
      socket.write(
        `POST /upload HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n` +
          `Cookie: postfan_session=${session.token}\r\nX-CSRF-Token: ${session.csrfToken}\r\nContent-Type: multipart/form-data; boundary=${boundary}\r\n` +
          "Content-Length: 1000000\r\nConnection: close\r\n\r\n" +
          prefix +
          "partial",
      );
      setTimeout(() => {
        socket.destroy();
        resolve();
      }, 30);
    });
    socket.on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(uploadsDir, { recursive: true });
  const before = new Set(fs.readdirSync(uploadsDir));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const created = await sessionService.createSession(1, "upload-test");
  const session = {
    token: created.token,
    csrfToken: sessionService.csrfTokenFor(created.token, process.env.SESSION_SECRET),
  };

  try {
    let response = await requestUpload(
      baseUrl,
      session,
      formWith("valid.png", Buffer.from("89504e470d0a1a0a", "hex"), "image/png"),
    );
    await expectStatus("imagem valida", response, 200);
    await recordCreatedFile(response);

    response = await requestUpload(
      baseUrl,
      session,
      formWith("valid.pdf", Buffer.from("%PDF-1.4\n%%EOF"), "application/pdf"),
    );
    await expectStatus("arquivo valido", response, 200);
    await recordCreatedFile(response);

    response = await requestUpload(
      baseUrl,
      session,
      formWith("too-large.png", new Uint8Array(10 * 1024 * 1024 + 1), "image/png"),
    );
    await expectStatus("arquivo acima do limite", response, 413);

    response = await requestUpload(
      baseUrl,
      session,
      formWith("invalid.exe", Buffer.from("invalid"), "application/octet-stream"),
    );
    await expectStatus("MIME invalido", response, 400);

    response = await requestUpload(
      baseUrl,
      session,
      formWith("mismatch.txt", Buffer.from("invalid"), "image/png"),
    );
    await expectStatus("extensao divergente", response, 400);

    response = await requestUpload(baseUrl, session, new FormData());
    await expectStatus("sem arquivo", response, 400);

    response = await requestUpload(
      baseUrl,
      session,
      formWith("one.png", Buffer.from("one"), "image/png", [
        { name: "two.png", content: Buffer.from("two"), type: "image/png" },
      ]),
    );
    await expectStatus("multiplos arquivos", response, 400);

    await interruptMultipart(port, session);
    await new Promise((resolve) => setTimeout(resolve, 100));
    response = await fetch(`${baseUrl}/healthz`);
    await expectStatus("saude apos interrupcao", response, 200);

    console.log("Upload: 8 cenarios funcionais validados.");
  } finally {
    for (const filename of createdFiles) {
      const target = path.resolve(uploadsDir, filename);
      if (path.dirname(target) === uploadsDir && fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    }
    await new Promise((resolve) => server.close(resolve));
    await pool.end();

    const after = fs.readdirSync(uploadsDir).filter((name) => !before.has(name));
    for (const filename of after) {
      const target = path.resolve(uploadsDir, filename);
      if (path.dirname(target) === uploadsDir && fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    }
  }
}

main().catch((error) => {
  console.error(`Falha no teste de upload: ${error.message}`);
  process.exitCode = 1;
});
