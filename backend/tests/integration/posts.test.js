const request = require("supertest");
const app = require("../../server");
const appPool = require("../../db");
const prisma = require("../../src/lib/prisma");
const { createTestUser } = require("../fixtures/factories");
const { authHeader } = require("../helpers/auth");
const { resetTestDatabase, testPool } = require("../helpers/database");
const { expectNoPrivateUserFields } = require("../helpers/privacy");

async function createPost(usuarioId, index = 0, criadoEm = new Date()) {
  return prisma.post.create({ data: { usuarioId, conteudo: `Post ${index}`, tema: "Teste", criadoEm, atualizadoEm: criadoEm } });
}

describe("posts e feed migrados para Prisma", () => {
  beforeEach(resetTestDatabase);
  afterEach(resetTestDatabase);
  afterAll(async () => { await prisma.$disconnect(); await appPool.end(); await testPool.end(); });

  it("cria post com texto normalizado e autor correto", async () => {
    const user = await createTestUser();
    const response = await request(app).post("/posts").set(await authHeader(user)).send({ conteudo: "  Minha ideia  ", tema: "Geral" }).expect(201);
    expect(response.body.post).toMatchObject({ usuario_id: user.id, conteudo: "Minha ideia", nome: user.nome });
    expectNoPrivateUserFields(response.body.post);
  });

  it("cria post com mídia válida sem texto", async () => {
    const user = await createTestUser();
    const response = await request(app).post("/posts").set(await authHeader(user)).attach("imagem", Buffer.from("89504e470d0a1a0a", "hex"), { filename: "post.png", contentType: "image/png" }).expect(201);
    expect(response.body.post.imagem).toMatch(/^\/uploads\//);
    await request(app).delete(`/posts/${response.body.post.id}`).set(await authHeader(user)).expect(200);
  });

  it.each(["", "     "])("rejeita texto vazio sem mídia: %j", async (conteudo) => {
    const user = await createTestUser();
    await request(app).post("/posts").set(await authHeader(user)).send({ conteudo }).expect(400);
  });

  it("rejeita criação sem autenticação ou sem CSRF", async () => {
    const user = await createTestUser();
    await request(app).post("/posts").send({ conteudo: "Teste" }).expect(401);
    const headers = await authHeader(user); delete headers["X-CSRF-Token"];
    await request(app).post("/posts").set(headers).send({ conteudo: "Teste" }).expect(403);
  });

  it("autor edita e outro usuário não edita", async () => {
    const owner = await createTestUser(); const other = await createTestUser(); const post = await createPost(owner.id);
    const edited = await request(app).put(`/posts/${post.id}`).set(await authHeader(owner)).send({ conteudo: " Atualizado " }).expect(200);
    expect(edited.body.post.conteudo).toBe("Atualizado");
    await request(app).put(`/posts/${post.id}`).set(await authHeader(other)).send({ conteudo: "Ataque" }).expect(403);
  });

  it("rejeita edição inexistente, inválida e sem CSRF", async () => {
    const user = await createTestUser(); const post = await createPost(user.id);
    await request(app).put("/posts/999999").set(await authHeader(user)).send({ conteudo: "Teste" }).expect(404);
    await request(app).put(`/posts/${post.id}`).set(await authHeader(user)).send({ conteudo: "   " }).expect(400);
    const headers = await authHeader(user); delete headers["X-CSRF-Token"];
    await request(app).put(`/posts/${post.id}`).set(headers).send({ conteudo: "Teste" }).expect(403);
  });

  it("autor exclui, outro não exclui e cascades são aplicadas", async () => {
    const owner = await createTestUser(); const other = await createTestUser(); const post = await createPost(owner.id);
    await prisma.curtida.create({ data: { usuarioId: other.id, postId: post.id } });
    await prisma.comentario.create({ data: { usuarioId: other.id, postId: post.id, conteudo: "x" } });
    await request(app).delete(`/posts/${post.id}`).set(await authHeader(other)).expect(403);
    await request(app).delete(`/posts/${post.id}`).set(await authHeader(owner)).expect(200);
    expect(await prisma.curtida.count({ where: { postId: post.id } })).toBe(0);
    expect(await prisma.comentario.count({ where: { postId: post.id } })).toBe(0);
  });

  it("retorna 404 ao excluir post inexistente e 403 sem CSRF", async () => {
    const user = await createTestUser(); const post = await createPost(user.id);
    await request(app).delete("/posts/999999").set(await authHeader(user)).expect(404);
    const headers = await authHeader(user); delete headers["X-CSRF-Token"];
    await request(app).delete(`/posts/${post.id}`).set(headers).expect(403);
  });

  it("feed ordena deterministicamente, conta agregados e não expõe dados privados", async () => {
    const viewer = await createTestUser(); const author = await createTestUser({ googleId: "private" });
    const when = new Date(); const first = await createPost(author.id, 1, when); const second = await createPost(author.id, 2, when);
    await prisma.curtida.create({ data: { usuarioId: viewer.id, postId: first.id } });
    await prisma.comentario.create({ data: { usuarioId: viewer.id, postId: first.id, conteudo: "x" } });
    const response = await request(app).get("/posts").set(await authHeader(viewer)).expect(200);
    expect(response.body.items.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(response.body.items[1]).toMatchObject({ total_curtidas: 1, total_comentarios: 1, curtiu: true });
    expectNoPrivateUserFields(response.body.items);
  });

  it("aplica limite padrão, máximo e cursor sem duplicações em 120 posts", async () => {
    const viewer = await createTestUser();
    await prisma.post.createMany({ data: Array.from({ length: 120 }, (_, index) => ({ usuarioId: viewer.id, conteudo: `Volume ${index}`, criadoEm: new Date(Date.now() + index), atualizadoEm: new Date(Date.now() + index) })) });
    const first = await request(app).get("/posts").set(await authHeader(viewer)).expect(200);
    expect(first.body.items).toHaveLength(20); expect(first.body.nextCursor).toBeTruthy();
    const second = await request(app).get("/posts").query({ cursor: first.body.nextCursor }).set(await authHeader(viewer)).expect(200);
    expect(new Set([...first.body.items, ...second.body.items].map((p) => p.id)).size).toBe(40);
    const max = await request(app).get("/posts").query({ limit: 1000000 }).set(await authHeader(viewer)).expect(200);
    expect(max.body.items).toHaveLength(50);
  });

  it("última página retorna cursor nulo", async () => {
    const viewer = await createTestUser(); await createPost(viewer.id);
    const response = await request(app).get("/posts").set(await authHeader(viewer)).expect(200);
    expect(response.body.nextCursor).toBeNull();
  });

  it("posts de perfil filtram autor, paginam e retornam 404 para perfil inexistente", async () => {
    const viewer = await createTestUser(); const author = await createTestUser(); const other = await createTestUser();
    await Promise.all([createPost(author.id, 1), createPost(author.id, 2), createPost(other.id, 3)]);
    const response = await request(app).get(`/usuarios/${author.id}/posts`).query({ limit: 1 }).set(await authHeader(viewer)).expect(200);
    expect(response.body.items).toHaveLength(1); expect(response.body.items[0].usuario_id).toBe(author.id); expect(response.body.nextCursor).toBeTruthy();
    expectNoPrivateUserFields(response.body.items);
    await request(app).get("/usuarios/999999/posts").set(await authHeader(viewer)).expect(404);
  });
});
