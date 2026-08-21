const bcrypt = require("bcrypt");
const request = require("supertest");
const app = require("../../server");
const appPool = require("../../db");
const prisma = require("../../src/lib/prisma");
const googleVerifier = require("../../src/modules/auth/google-verifier");
const sessionService = require("../../src/modules/auth/session.service");
const { createTestUser } = require("../fixtures/factories");
const { resetTestDatabase, testPool } = require("../helpers/database");

async function passwordUser(email = "session@test.local") {
  return createTestUser({ email, senha: await bcrypt.hash("SenhaTeste123", 4) });
}

async function login(agent, email = "session@test.local") {
  return agent.post("/login").send({ email, senha: "SenhaTeste123" }).expect(200);
}

describe("sessoes opacas e CSRF", () => {
  beforeEach(resetTestDatabase);
  afterEach(async () => { vi.restoreAllMocks(); process.env.NODE_ENV = "test"; await resetTestDatabase(); });
  afterAll(async () => { await prisma.$disconnect(); await appPool.end(); await testPool.end(); });

  it("login cria sessão, cookie seguro e não retorna segredo", async () => {
    await passwordUser();
    const response = await login(request.agent(app));
    const cookie = response.headers["set-cookie"][0];
    expect(cookie).toMatch(/postfan_session=.*HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(response.body.token).toBeUndefined();
    expect(response.body.csrfToken).toEqual(expect.any(String));
  });

  it("produção marca o cookie como Secure", async () => {
    await passwordUser(); process.env.NODE_ENV = "production";
    const response = await login(request.agent(app));
    expect(response.headers["set-cookie"][0]).toMatch(/Secure/i);
  });

  it("banco guarda somente hash do token de sessão", async () => {
    await passwordUser();
    const response = await login(request.agent(app));
    const raw = response.headers["set-cookie"][0].match(/postfan_session=([^;]+)/)[1];
    const stored = await prisma.session.findFirst();
    expect(stored.tokenHash).toBe(sessionService.hashToken(raw));
    expect(stored.tokenHash).not.toBe(raw);
  });

  it("cookie autentica /me e ausência de cookie é negada", async () => {
    await passwordUser(); const agent = request.agent(app); await login(agent);
    await agent.get("/me").expect(200);
    await request(app).get("/me").expect(401);
  });

  it("sessões inválida, expirada e revogada são negadas", async () => {
    await request(app).get("/me").set("Cookie", "postfan_session=invalid").expect(401);
    const user = await passwordUser();
    for (const data of [{ expiraEm: new Date(0) }, { revogadoEm: new Date() }]) {
      const session = await sessionService.createSession(user.id, "test");
      await prisma.session.update({ where: { id: session.id }, data });
      await request(app).get("/me").set("Cookie", `postfan_session=${session.token}`).expect(401);
    }
  });

  it("logout exige CSRF, revoga e cookie antigo não autentica", async () => {
    await passwordUser(); const agent = request.agent(app); const signed = await login(agent);
    await agent.post("/logout").expect(403);
    await agent.post("/logout").set("X-CSRF-Token", signed.body.csrfToken).expect(200);
    await agent.get("/me").expect(401);
    expect((await prisma.session.findFirst()).revogadoEm).toBeTruthy();
  });

  it("logout global revoga todas as sessões do usuário", async () => {
    const user = await passwordUser(); const first = request.agent(app); const second = request.agent(app);
    const signed = await login(first); await login(second); expect(await prisma.session.count({ where: { usuarioId: user.id } })).toBe(2);
    await first.post("/sessions/revoke-all").set("X-CSRF-Token", signed.body.csrfToken).expect(200);
    expect(await prisma.session.count({ where: { usuarioId: user.id, revogadoEm: null } })).toBe(0);
    await second.get("/me").expect(401);
  });

  it("Google cria o mesmo tipo de sessão opaca", async () => {
    vi.spyOn(googleVerifier, "verify").mockResolvedValue({ sub: "g-session", email: "google.session@test.local", email_verified: true });
    const response = await request(app).post("/auth/google").send({ credential: "mock" }).expect(200);
    expect(response.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(response.body.token).toBeUndefined();
    expect(await prisma.session.count()).toBe(1);
  });

  it("CSRF correto permite mutação; ausente ou errado são negados", async () => {
    await passwordUser(); const agent = request.agent(app); const signed = await login(agent);
    await agent.put("/perfil").field("nome", "Sem CSRF").expect(403);
    await agent.put("/perfil").set("X-CSRF-Token", "errado").field("nome", "Errado").expect(403);
    await agent.put("/perfil").set("X-CSRF-Token", signed.body.csrfToken).field("nome", "Correto").expect(200);
    await agent.get("/me").expect(200);
  });

  it("DELETE sem CSRF é negado", async () => {
    await passwordUser(); const agent = request.agent(app); await login(agent);
    await agent.delete("/conta").expect(403);
  });

  it("CSRF de uma sessão não funciona em outra", async () => {
    await passwordUser(); const a = request.agent(app); const b = request.agent(app);
    const loginA = await login(a); await login(b);
    await b.put("/perfil").set("X-CSRF-Token", loginA.body.csrfToken).field("nome", "Ataque").expect(403);
  });

  it("reset de senha revoga todas as sessões anteriores", async () => {
    const user = await passwordUser(); const agent = request.agent(app); await login(agent);
    await prisma.usuario.update({ where: { id: user.id }, data: { tokenRecuperacao: sessionService.hashToken("reset-secret"), tokenExpira: new Date(Date.now() + 60000) } });
    await request(app).post("/resetar").send({ token: "reset-secret", novaSenha: "SenhaNova123" }).expect(200);
    await agent.get("/me").expect(401);
  });
});
