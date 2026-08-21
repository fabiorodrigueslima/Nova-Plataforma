const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const request = require("supertest");
const app = require("../../server");
const appPool = require("../../db");
const prisma = require("../../src/lib/prisma");
const googleVerifier = require("../../src/modules/auth/google-verifier");
const { createTestUser } = require("../fixtures/factories");
const { resetTestDatabase, testPool } = require("../helpers/database");
const { expectNoPrivateUserFields } = require("../helpers/privacy");
const { hashToken } = require("../../src/modules/auth/session.service");

function mockEmailTransport() {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "test-message" });
  vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail });
  return sendMail;
}

async function createPasswordUser(overrides = {}) {
  const password = overrides.password || "SenhaTeste123";
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await createTestUser({
    ...(overrides.email ? { email: overrides.email } : {}),
    ...(overrides.nome ? { nome: overrides.nome } : {}),
    senha: passwordHash,
  });
  return { password, passwordHash, user };
}

describe("autenticacao migrada para Prisma", () => {
  beforeEach(resetTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    await resetTestDatabase();
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await appPool.end();
    await testPool.end();
  });

  it("cadastra usuario valido com email normalizado", async () => {
    const response = await request(app)
      .post("/cadastro")
      .send({ nome: "Fabio Test", email: "  Fabio@Test.Local  ", senha: "123456" })
      .expect(201);

    expect(response.body.usuario.email).toBe("fabio@test.local");
    expect(response.body.token).toBeUndefined();
    expect(response.body.csrfToken).toEqual(expect.any(String));
    expectNoPrivateUserFields(response.body, { allowEmail: true });
  });

  it("armazena senha como hash bcrypt", async () => {
    await request(app)
      .post("/cadastro")
      .send({ nome: "Alice", email: "alice@test.local", senha: "123456" })
      .expect(201);
    const stored = await testPool.query(
      "SELECT senha FROM usuarios WHERE email = 'alice@test.local'",
    );
    expect(stored.rows[0].senha).not.toBe("123456");
    expect(await bcrypt.compare("123456", stored.rows[0].senha)).toBe(true);
  });

  it("rejeita email duplicado exato com erro seguro", async () => {
    await createPasswordUser({ email: "duplicate@test.local" });
    const response = await request(app)
      .post("/cadastro")
      .send({ nome: "Duplicado", email: "duplicate@test.local", senha: "123456" })
      .expect(409);
    expect(response.body.erro).toMatch(/cadastrado/i);
    expect(JSON.stringify(response.body)).not.toMatch(/P2002|constraint|Prisma/i);
  });

  it("rejeita email duplicado com caixa diferente", async () => {
    await createPasswordUser({ email: "case@test.local" });
    await request(app)
      .post("/cadastro")
      .send({ nome: "Duplicado", email: "CASE@Test.Local", senha: "123456" })
      .expect(409);
  });

  it("faz login com email em caixa diferente e com espacos", async () => {
    const { password, user } = await createPasswordUser({
      email: "login@test.local",
    });
    const response = await request(app)
      .post("/login")
      .send({ email: "  LOGIN@Test.Local ", senha: password })
      .expect(200);
    expect(response.body).toMatchObject({ autenticado: true });
    expect(response.body.usuario.email).toBe(user.email);
    expectNoPrivateUserFields(response.body, { allowEmail: true });
  });

  it("responde genericamente para senha incorreta", async () => {
    await createPasswordUser({ email: "wrong-password@test.local" });
    const response = await request(app)
      .post("/login")
      .send({ email: "wrong-password@test.local", senha: "incorreta" })
      .expect(200);
    expect(response.body).toMatchObject({ autenticado: false });
    expect(response.body.erro).toMatch(/inválidos/i);
  });

  it("responde genericamente para usuario inexistente", async () => {
    const response = await request(app)
      .post("/login")
      .send({ email: "missing@test.local", senha: "incorreta" })
      .expect(200);
    expect(response.body).toMatchObject({ autenticado: false });
    expect(response.body.erro).toMatch(/inválidos/i);
  });

  it("cria conta Google nova somente com email verificado", async () => {
    vi.spyOn(googleVerifier, "verify").mockResolvedValue({
      sub: "google-new-id",
      email: "  New.Google@Test.Local ",
      email_verified: true,
      name: "Google Test",
      picture: null,
    });
    const response = await request(app)
      .post("/auth/google")
      .send({ credential: "external-token-mocked" })
      .expect(200);
    expect(response.body.usuario.email).toBe("new.google@test.local");
    expectNoPrivateUserFields(response.body, { allowEmail: true });
  });

  it("vincula Google a conta local existente sem duplicar", async () => {
    const { user } = await createPasswordUser({ email: "linked@test.local" });
    vi.spyOn(googleVerifier, "verify").mockResolvedValue({
      sub: "google-linked-id",
      email: "LINKED@Test.Local",
      email_verified: true,
      name: "Linked",
    });
    await request(app)
      .post("/auth/google")
      .send({ credential: "external-token-mocked" })
      .expect(200);
    const users = await testPool.query(
      "SELECT id, google_id FROM usuarios WHERE LOWER(email) = 'linked@test.local'",
    );
    expect(users.rowCount).toBe(1);
    expect(users.rows[0]).toMatchObject({ id: user.id, google_id: "google-linked-id" });
  });

  it("permite novo login de conta Google ja vinculada", async () => {
    const user = await createTestUser({
      email: "google-existing@test.local",
      senha: null,
      googleId: "google-existing-id",
    });
    vi.spyOn(googleVerifier, "verify").mockResolvedValue({
      sub: "google-existing-id",
      email: "google-existing@test.local",
      email_verified: true,
      name: user.nome,
    });
    const response = await request(app)
      .post("/auth/google")
      .send({ credential: "external-token-mocked" })
      .expect(200);
    expect(response.body.usuario.id).toBe(user.id);
  });

  it("nega token Google invalido", async () => {
    vi.spyOn(googleVerifier, "verify").mockRejectedValue(new Error("invalid token"));
    await request(app)
      .post("/auth/google")
      .send({ credential: "invalid-external-token" })
      .expect(401);
  });

  it("nega email Google nao verificado", async () => {
    vi.spyOn(googleVerifier, "verify").mockResolvedValue({
      sub: "unverified-id",
      email: "unverified@test.local",
      email_verified: false,
    });
    await request(app)
      .post("/auth/google")
      .send({ credential: "external-token-mocked" })
      .expect(400);
    const count = await testPool.query("SELECT COUNT(*)::int total FROM usuarios");
    expect(count.rows[0].total).toBe(0);
  });

  it("recuperacao normaliza email, cria token e expiracao sem vazar token", async () => {
    const { user } = await createPasswordUser({ email: "recover@test.local" });
    const sendMail = mockEmailTransport();
    const response = await request(app)
      .post("/recuperar")
      .send({ email: "  RECOVER@Test.Local " })
      .expect(200);
    const stored = await testPool.query(
      "SELECT token_recuperacao, token_expira FROM usuarios WHERE id = $1",
      [user.id],
    );
    expect(stored.rows[0].token_recuperacao).toEqual(expect.any(String));
    expect(stored.rows[0].token_expira).toBeTruthy();
    expect(sendMail).toHaveBeenCalledOnce();
    const html = sendMail.mock.calls[0][0].html;
    const rawToken = decodeURIComponent(html.match(/token=([^"&<]+)/)[1]);
    expect(stored.rows[0].token_recuperacao).toBe(hashToken(rawToken));
    expect(stored.rows[0].token_recuperacao).not.toBe(rawToken);
    expect(JSON.stringify(response.body)).not.toContain(stored.rows[0].token_recuperacao);
  });

  it("recuperacao nao permite enumerar conta existente", async () => {
    await createPasswordUser({ email: "exists@test.local" });
    mockEmailTransport();
    const existing = await request(app)
      .post("/recuperar")
      .send({ email: "exists@test.local" })
      .expect(200);
    const missing = await request(app)
      .post("/recuperar")
      .send({ email: "missing@test.local" })
      .expect(200);
    expect(existing.body).toEqual(missing.body);
  });

  it("falha SMTP nao revela que a conta existe", async () => {
    await createPasswordUser({ email: "smtp-failure@test.local" });
    const smtpError = Object.assign(new Error("smtp unavailable"), {
      code: "ETIMEDOUT",
    });
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: vi.fn().mockRejectedValue(smtpError),
    });
    const response = await request(app)
      .post("/recuperar")
      .send({ email: "smtp-failure@test.local" })
      .expect(200);
    expect(response.body.mensagem).toMatch(/cadastrado/i);
  });

  it("redefine senha com token valido, invalida uso seguinte e atualiza hash", async () => {
    const { passwordHash, user } = await createPasswordUser({
      email: "reset@test.local",
      password: "SenhaAntiga123",
    });
    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        tokenRecuperacao: hashToken("single-use-token"),
        tokenExpira: new Date(Date.now() + 60_000),
      },
    });
    await request(app)
      .post("/resetar")
      .send({ token: "single-use-token", novaSenha: "SenhaNova123" })
      .expect(200);
    const stored = await testPool.query(
      "SELECT senha, token_recuperacao, token_expira FROM usuarios WHERE id = $1",
      [user.id],
    );
    expect(stored.rows[0].senha).not.toBe(passwordHash);
    expect(await bcrypt.compare("SenhaNova123", stored.rows[0].senha)).toBe(true);
    expect(await bcrypt.compare("SenhaAntiga123", stored.rows[0].senha)).toBe(false);
    expect(stored.rows[0].token_recuperacao).toBeNull();
    expect(stored.rows[0].token_expira).toBeNull();

    const oldLogin = await request(app)
      .post("/login")
      .send({ email: "reset@test.local", senha: "SenhaAntiga123" })
      .expect(200);
    expect(oldLogin.body.autenticado).toBe(false);

    const newLogin = await request(app)
      .post("/login")
      .send({ email: "RESET@Test.Local", senha: "SenhaNova123" })
      .expect(200);
    expect(newLogin.body.autenticado).toBe(true);

    await request(app)
      .post("/resetar")
      .send({ token: "single-use-token", novaSenha: "OutraSenha123" })
      .expect(400);
  });

  it("rejeita token de reset invalido", async () => {
    await request(app)
      .post("/resetar")
      .send({ token: "invalid-token", novaSenha: "SenhaNova123" })
      .expect(400);
  });

  it("rejeita token de reset expirado", async () => {
    const { user } = await createPasswordUser({ email: "expired@test.local" });
    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        tokenRecuperacao: hashToken("expired-token"),
        tokenExpira: new Date(Date.now() - 60_000),
      },
    });
    const response = await request(app)
      .post("/resetar")
      .send({ token: "expired-token", novaSenha: "SenhaNova123" })
      .expect(400);
    expect(response.body.erro).toMatch(/expirado/i);
  });
});
