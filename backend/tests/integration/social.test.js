const request = require("supertest");
const app = require("../../server");
const appPool = require("../../db");
const prisma = require("../../src/lib/prisma");
const { createTestUser } = require("../fixtures/factories");
const { authHeader } = require("../helpers/auth");
const { resetTestDatabase, testPool } = require("../helpers/database");

describe("interações sociais, busca e notificações", () => {
  beforeEach(resetTestDatabase);
  afterEach(resetTestDatabase);
  afterAll(async () => { await prisma.$disconnect(); await appPool.end(); await testPool.end(); });

  it("retorna um post individual sem dados privados", async () => {
    const viewer = await createTestUser();
    const author = await createTestUser({ email: "private-author@test.local" });
    const post = await prisma.post.create({ data: { usuarioId: author.id, conteudo: "Post individual" } });
    const response = await request(app).get(`/posts/${post.id}`).set(await authHeader(viewer)).expect(200);
    expect(response.body.post).toMatchObject({ id: post.id, nome: author.nome, curtiu: false });
    expect(JSON.stringify(response.body)).not.toContain(author.email);
  });

  it("curte e descurte sem duplicidade e notifica o autor uma vez", async () => {
    const author = await createTestUser(); const actor = await createTestUser();
    const post = await prisma.post.create({ data: { usuarioId: author.id, conteudo: "Curtir" } });
    const headers = await authHeader(actor);
    await request(app).post(`/posts/${post.id}/like`).set(headers).expect(200).expect(({ body }) => expect(body.curtiu).toBe(true));
    expect(await prisma.notificacao.count({ where: { destinatarioId: author.id, tipo: "curtida" } })).toBe(1);
    await request(app).post(`/posts/${post.id}/like`).set(headers).expect(200).expect(({ body }) => expect(body.curtiu).toBe(false));
    expect(await prisma.curtida.count({ where: { usuarioId: actor.id, postId: post.id } })).toBe(0);
  });

  it("impede compartilhamento duplicado e notifica o autor", async () => {
    const author = await createTestUser(); const actor = await createTestUser();
    const post = await prisma.post.create({ data: { usuarioId: author.id, conteudo: "Compartilhar" } });
    const headers = await authHeader(actor);
    await request(app).post(`/posts/${post.id}/share`).set(headers).expect(201);
    await request(app).post(`/posts/${post.id}/share`).set(headers).expect(409);
    expect(await prisma.compartilhamento.count({ where: { usuarioId: actor.id, postId: post.id } })).toBe(1);
  });

  it("segue, deixa de seguir e protege contra auto-seguimento", async () => {
    const actor = await createTestUser(); const target = await createTestUser(); const headers = await authHeader(actor);
    await request(app).post(`/users/${actor.id}/follow`).set(headers).expect(400);
    await request(app).post(`/users/${target.id}/follow`).set(headers).expect(200).expect(({ body }) => expect(body.seguindo).toBe(true));
    expect(await prisma.notificacao.count({ where: { destinatarioId: target.id, tipo: "seguidor" } })).toBe(1);
    await request(app).post(`/users/${target.id}/follow`).set(headers).expect(200).expect(({ body }) => expect(body.seguindo).toBe(false));
  });

  it("pesquisa usuários e posts com paginação limitada", async () => {
    const viewer = await createTestUser(); const author = await createTestUser({ nome: "Ana Astronomia", bio: "Ciência" });
    await prisma.post.create({ data: { usuarioId: author.id, conteudo: "Astronomia para todos" } });
    const response = await request(app).get("/search").query({ q: "astronomia", limit: 1 }).set(await authHeader(viewer)).expect(200);
    expect(response.body.users[0].id).toBe(author.id);
    expect(response.body.posts[0].usuario.id).toBe(author.id);
    await request(app).get("/search").query({ q: "a" }).set(await authHeader(viewer)).expect(400);
  });

  it("lista e marca somente as próprias notificações como lidas", async () => {
    const owner = await createTestUser(); const other = await createTestUser();
    const notification = await prisma.notificacao.create({ data: { destinatarioId: owner.id, atorId: other.id, tipo: "seguidor", mensagem: "começou a seguir você." } });
    const response = await request(app).get("/notifications").set(await authHeader(owner)).expect(200);
    expect(response.body.unread).toBe(1);
    await request(app).patch(`/notifications/${notification.id}/read`).set(await authHeader(other)).expect(404);
    await request(app).patch("/notifications/read-all").set(await authHeader(owner)).expect(200);
    expect((await prisma.notificacao.findUnique({ where: { id: notification.id } })).lidaEm).toBeTruthy();
  });
});
