const request = require("supertest");
const app = require("../../server");
const appPool = require("../../db");
const prisma = require("../../src/lib/prisma");
const { createTestFollow, createTestUser } = require("../fixtures/factories");
const { authHeader } = require("../helpers/auth");
const { resetTestDatabase, testPool } = require("../helpers/database");
const { expectNoPrivateUserFields } = require("../helpers/privacy");

describe("API de usuarios migrada para Prisma", () => {
  beforeEach(resetTestDatabase);
  afterEach(resetTestDatabase);
  afterAll(async () => {
    await prisma.$disconnect();
    await appPool.end();
    await testPool.end();
  });

  it("retorna perfil publico encontrado com o contrato esperado", async () => {
    const viewer = await createTestUser();
    const other = await createTestUser({
      nome: "Alice Test",
      email: "alice@test.local",
      bio: "Perfil ficticio",
      googleId: "internal-google-id",
    });
    const response = await request(app)
      .get(`/usuarios/${other.id}`)
      .set(await authHeader(viewer))
      .expect(200);

    expect(response.body).toMatchObject({
      id: other.id,
      nome: "Alice Test",
      bio: "Perfil ficticio",
    });
    expectNoPrivateUserFields(response.body);
  });

  it("retorna 404 para perfil publico inexistente", async () => {
    const viewer = await createTestUser();
    await request(app).get("/usuarios/999999").set(await authHeader(viewer)).expect(404);
  });

  it("nunca retorna email, hash ou google_id no perfil publico", async () => {
    const viewer = await createTestUser();
    const other = await createTestUser({ googleId: "private-google-id" });
    const response = await request(app)
      .get(`/usuarios/${other.id}`)
      .set(await authHeader(viewer))
      .expect(200);
    expectNoPrivateUserFields(response.body);
  });

  it("retorna somente campos privados legitimos no proprio perfil", async () => {
    const user = await createTestUser({ googleId: "private-google-id" });
    const response = await request(app)
      .get("/me")
      .set(await authHeader(user))
      .expect(200);

    expect(response.body.usuario.email).toBe(user.email);
    expectNoPrivateUserFields(response.body.usuario, { allowEmail: true });
  });

  it("edita o perfil preservando o contrato privado e sem expor segredos", async () => {
    const user = await createTestUser({ googleId: "private-google-id" });
    const response = await request(app)
      .put("/perfil")
      .set(await authHeader(user))
      .field("nome", "Nome Atualizado")
      .field("bio", "Bio atualizada")
      .expect(200);

    expect(response.body.usuario).toMatchObject({
      id: user.id,
      nome: "Nome Atualizado",
      email: user.email,
      bio: "Bio atualizada",
    });
    expectNoPrivateUserFields(response.body, { allowEmail: true });
  });

  it("exclui conta e registra auditoria na mesma transacao", async () => {
    const user = await createTestUser();
    await request(app)
      .delete("/conta")
      .set(await authHeader(user))
      .send({ motivo: "Fixture de exclusao" })
      .expect(200);

    const [userResult, auditResult] = await Promise.all([
      testPool.query("SELECT id FROM usuarios WHERE id = $1", [user.id]),
      testPool.query(
        "SELECT motivo, status FROM exclusoes_conta WHERE usuario_id = $1",
        [user.id],
      ),
    ]);
    expect(userResult.rowCount).toBe(0);
    expect(auditResult.rows[0]).toMatchObject({
      motivo: "Fixture de exclusao",
      status: "concluida",
    });
  });

  it("sugestoes possuem limite e nao retornam email", async () => {
    const viewer = await createTestUser();
    for (let index = 0; index < 22; index += 1) await createTestUser();
    const response = await request(app)
      .get("/usuarios/sugestoes")
      .set(await authHeader(viewer))
      .expect(200);

    expect(response.body).toHaveLength(20);
    expectNoPrivateUserFields(response.body);
  });

  it("lista de seguidores nao retorna email", async () => {
    const viewer = await createTestUser();
    const follower = await createTestUser();
    await createTestFollow(follower.id, viewer.id);
    const response = await request(app)
      .get("/usuarios/seguidores")
      .set(await authHeader(viewer))
      .expect(200);

    expect(response.body[0].id).toBe(follower.id);
    expectNoPrivateUserFields(response.body);
  });

  it("lista de seguindo nao retorna email", async () => {
    const viewer = await createTestUser();
    const followed = await createTestUser();
    await createTestFollow(viewer.id, followed.id);
    const response = await request(app)
      .get("/usuarios/seguindo")
      .set(await authHeader(viewer))
      .expect(200);

    expect(response.body[0]).toMatchObject({ id: followed.id, seguindo: true });
    expectNoPrivateUserFields(response.body);
  });

  it("usuarios online nao retornam email", async () => {
    const viewer = await createTestUser();
    const online = await createTestUser();
    await prisma.usuario.update({
      where: { id: online.id },
      data: { ultimoAcesso: new Date() },
    });
    const response = await request(app)
      .get("/usuarios/online")
      .set(await authHeader(viewer))
      .expect(200);

    expect(response.body[0]).toMatchObject({ id: online.id, online: true });
    expectNoPrivateUserFields(response.body);
  });

  it("feed nao retorna email do autor", async () => {
    const viewer = await createTestUser();
    const author = await createTestUser();
    await testPool.query(
      "INSERT INTO posts (usuario_id, conteudo) VALUES ($1, 'Post ficticio')",
      [author.id],
    );
    const response = await request(app)
      .get("/posts")
      .set(await authHeader(viewer))
      .expect(200);
    expect(response.body.items[0].nome).toBe(author.nome);
    expectNoPrivateUserFields(response.body.items);
  });

  it("posts do perfil nao retornam email do autor", async () => {
    const viewer = await createTestUser();
    const author = await createTestUser();
    await testPool.query(
      "INSERT INTO posts (usuario_id, conteudo) VALUES ($1, 'Post de perfil')",
      [author.id],
    );
    const response = await request(app)
      .get(`/usuarios/${author.id}/posts`)
      .set(await authHeader(viewer))
      .expect(200);
    expect(response.body.items[0].nome).toBe(author.nome);
    expectNoPrivateUserFields(response.body.items);
  });

  it("recusa usuario nao autenticado nos endpoints privados", async () => {
    await request(app).get("/me").expect(401);
    await request(app).get("/usuarios/sugestoes").expect(401);
    await request(app).get("/usuarios/1").expect(401);
  });
});
