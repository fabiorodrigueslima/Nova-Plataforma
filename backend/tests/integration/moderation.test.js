const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../server");
const appPool = require("../../db");
const prisma = require("../../src/lib/prisma");
const { createTestFollow, createTestUser } = require("../fixtures/factories");
const { authHeader } = require("../helpers/auth");
const { resetTestDatabase, testPool } = require("../helpers/database");

async function createAdmin(papel = "admin") {
  const user = await createTestUser();
  await testPool.query("UPDATE usuarios SET papel = $1 WHERE id = $2", [papel, user.id]);
  return { ...user, papel };
}

async function createPost(usuarioId, conteudo = "Conteúdo original") {
  return prisma.post.create({ data: { usuarioId, conteudo, tema: "Política" } });
}

describe("moderação e bloqueio", () => {
  beforeEach(resetTestDatabase);
  afterEach(resetTestDatabase);
  afterAll(async () => { await prisma.$disconnect(); await appPool.end(); await testPool.end(); });

  describe("denúncias", () => {
    it("denúncia de post registra o autor e guarda cópia do texto", async () => {
      const autor = await createTestUser(); const denunciante = await createTestUser();
      const post = await createPost(autor.id, "Texto ofensivo de exemplo");
      await request(app).post("/denuncias").set(await authHeader(denunciante)).send({ post_id: post.id, motivo: "Discurso de ódio" }).expect(201);
      const row = (await testPool.query("SELECT usuario_id, post_id, conteudo_denunciado, status FROM denuncias")).rows[0];
      expect(row).toMatchObject({ usuario_id: autor.id, post_id: post.id, conteudo_denunciado: "Texto ofensivo de exemplo", status: "pendente" });
    });

    it("não permite denunciar o próprio post nem alvo inválido", async () => {
      const autor = await createTestUser(); const post = await createPost(autor.id);
      await request(app).post("/denuncias").set(await authHeader(autor)).send({ post_id: post.id, motivo: "x" }).expect(400);
      await request(app).post("/denuncias").set(await authHeader(autor)).send({ post_id: "abc", motivo: "x" }).expect(400);
    });
  });

  describe("painel da equipe", () => {
    it("usuário comum não acessa rotas de moderação", async () => {
      const user = await createTestUser();
      const headers = await authHeader(user);
      await request(app).get("/admin/denuncias").set(headers).expect(403);
      await request(app).get("/admin/metricas").set(headers).expect(403);
      await request(app).post("/admin/denuncias/1/resolver").set(headers).send({ acao: "arquivar" }).expect(403);
    });

    it("moderador lista pendentes e remove o post, mantendo o histórico", async () => {
      const mod = await createAdmin("moderador"); const autor = await createTestUser();
      const d1 = await createTestUser(); const d2 = await createTestUser();
      const post = await createPost(autor.id, "Post problemático");
      await request(app).post("/denuncias").set(await authHeader(d1)).send({ post_id: post.id, motivo: "Ódio" }).expect(201);
      await request(app).post("/denuncias").set(await authHeader(d2)).send({ post_id: post.id, motivo: "Ofensa" }).expect(201);
      const headers = await authHeader(mod);

      const lista = await request(app).get("/admin/denuncias").set(headers).expect(200);
      expect(lista.body).toHaveLength(2);
      expect(lista.body[0]).toMatchObject({ status: "pendente", denunciado: { id: autor.id }, post: { id: post.id } });

      const res = await request(app).post(`/admin/denuncias/${lista.body[0].id}/resolver`).set(headers).send({ acao: "remover_post" }).expect(200);
      expect(res.body.mensagem).toMatch(/removida/i);
      expect(await prisma.post.findUnique({ where: { id: post.id } })).toBeNull();

      const resolvidas = await request(app).get("/admin/denuncias?status=resolvida").set(headers).expect(200);
      expect(resolvidas.body).toHaveLength(2);
      expect(resolvidas.body[0]).toMatchObject({ acao: "remover_post", post: null, post_removido: true, conteudo_denunciado: "Post problemático", resolvido_por: { id: mod.id } });
      await request(app).post(`/admin/denuncias/${lista.body[1].id}/resolver`).set(headers).send({ acao: "arquivar" }).expect(409);
    });

    it("arquivar marca a denúncia como rejeitada", async () => {
      const admin = await createAdmin(); const autor = await createTestUser(); const d = await createTestUser();
      const post = await createPost(autor.id);
      await request(app).post("/denuncias").set(await authHeader(d)).send({ post_id: post.id, motivo: "Não gostei" }).expect(201);
      const [{ id }] = (await request(app).get("/admin/denuncias").set(await authHeader(admin))).body;
      await request(app).post(`/admin/denuncias/${id}/resolver`).set(await authHeader(admin)).send({ acao: "arquivar" }).expect(200);
      expect((await testPool.query("SELECT status, acao FROM denuncias WHERE id = $1", [id])).rows[0]).toEqual({ status: "rejeitada", acao: "arquivar" });
      expect(await prisma.post.findUnique({ where: { id: post.id } })).not.toBeNull();
    });

    it("suspender derruba as sessões, bloqueia login e pode ser revertido", async () => {
      const admin = await createAdmin();
      const senhaHash = await bcrypt.hash("senha-do-autor", 4);
      const autor = await createTestUser({ email: "suspenso@test.local", senha: senhaHash });
      const d = await createTestUser();
      const sessaoAutor = await authHeader(autor);
      await request(app).post("/denuncias").set(await authHeader(d)).send({ usuario_id: autor.id, motivo: "Assédio" }).expect(201);
      const [{ id }] = (await request(app).get("/admin/denuncias").set(await authHeader(admin))).body;

      const res = await request(app).post(`/admin/denuncias/${id}/resolver`).set(await authHeader(admin)).send({ acao: "suspender_usuario", dias: 3 }).expect(200);
      expect(new Date(res.body.suspenso_ate).getTime()).toBeGreaterThan(Date.now() + 2 * 24 * 3600 * 1000);

      await request(app).get("/me").set(sessaoAutor).expect(401);
      const login = await request(app).post("/login").send({ email: "suspenso@test.local", senha: "senha-do-autor" }).expect(403);
      expect(login.body).toMatchObject({ autenticado: false, codigo: "CONTA_SUSPENSA" });

      await request(app).post(`/admin/usuarios/${autor.id}/reativar`).set(await authHeader(admin)).expect(200);
      const ok = await request(app).post("/login").send({ email: "suspenso@test.local", senha: "senha-do-autor" }).expect(200);
      expect(ok.body.autenticado).toBe(true);
    });

    it("equipe não pode ser suspensa pelo painel", async () => {
      const admin = await createAdmin(); const outroMod = await createAdmin("moderador"); const d = await createTestUser();
      await request(app).post("/denuncias").set(await authHeader(d)).send({ usuario_id: outroMod.id, motivo: "x" }).expect(201);
      const [{ id }] = (await request(app).get("/admin/denuncias").set(await authHeader(admin))).body;
      await request(app).post(`/admin/denuncias/${id}/resolver`).set(await authHeader(admin)).send({ acao: "suspender_usuario" }).expect(403);
    });

    it("/me informa o papel para o frontend exibir o painel", async () => {
      const admin = await createAdmin();
      const me = await request(app).get("/me").set(await authHeader(admin)).expect(200);
      expect(me.body.usuario.papel).toBe("admin");
    });

    it("métricas trazem contagens e temas", async () => {
      const admin = await createAdmin(); const autor = await createTestUser();
      await createPost(autor.id); await createPost(autor.id);
      const res = await request(app).get("/admin/metricas").set(await authHeader(admin)).expect(200);
      expect(res.body.usuarios.total).toBe(2);
      expect(res.body.atividade_7d.posts).toBe(2);
      expect(res.body.temas_30d).toEqual([{ tema: "Política", posts: 2 }]);
    });
  });

  describe("bloqueio", () => {
    it("bloquear esconde o feed nos dois sentidos e desfaz o seguir", async () => {
      const a = await createTestUser(); const b = await createTestUser(); const c = await createTestUser();
      await createTestFollow(a.id, b.id); await createTestFollow(b.id, a.id);
      await createPost(b.id, "Post do B"); await createPost(c.id, "Post do C"); await createPost(a.id, "Post do A");

      const res = await request(app).post(`/usuarios/${b.id}/bloquear`).set(await authHeader(a)).expect(200);
      expect(res.body.bloqueado).toBe(true);
      expect((await testPool.query("SELECT count(*)::int n FROM seguidores")).rows[0].n).toBe(0);

      const feedA = await request(app).get("/posts").set(await authHeader(a)).expect(200);
      expect(feedA.body.items.map((p) => p.conteudo).sort()).toEqual(["Post do A", "Post do C"]);
      const feedB = await request(app).get("/posts").set(await authHeader(b)).expect(200);
      expect(feedB.body.items.map((p) => p.conteudo).sort()).toEqual(["Post do B", "Post do C"]);
      const perfilB = await request(app).get(`/usuarios/${b.id}/posts`).set(await authHeader(a)).expect(200);
      expect(perfilB.body.items).toEqual([]);
    });

    it("bloqueado não manda mensagem, não comenta, não segue e não vê o perfil de quem bloqueou", async () => {
      const a = await createTestUser(); const b = await createTestUser();
      const postA = await createPost(a.id);
      await request(app).post(`/usuarios/${b.id}/bloquear`).set(await authHeader(a)).expect(200);
      const hb = await authHeader(b);
      await request(app).post("/mensagens").set(hb).send({ destinatario_id: a.id, mensagem: "oi" }).expect(403);
      await request(app).post("/mensagens").set(await authHeader(a)).send({ destinatario_id: b.id, mensagem: "oi" }).expect(403);
      await request(app).post("/comentarios").set(hb).send({ post_id: postA.id, conteudo: "comentário" }).expect(403);
      await request(app).post(`/users/${a.id}/follow`).set(hb).expect(403);
      await request(app).get(`/usuarios/${a.id}`).set(hb).expect(404);
      // Quem bloqueou ainda vê o perfil e sabe que bloqueou.
      const stats = await request(app).get(`/perfil/stats/${b.id}`).set(await authHeader(a)).expect(200);
      expect(stats.body.bloqueado_por_mim).toBe(true);
    });

    it("desbloquear restaura e a lista de bloqueados funciona", async () => {
      const a = await createTestUser(); const b = await createTestUser();
      const ha = await authHeader(a);
      await request(app).post(`/usuarios/${b.id}/bloquear`).set(ha).expect(200);
      const lista = await request(app).get("/bloqueios").set(ha).expect(200);
      expect(lista.body).toEqual([expect.objectContaining({ id: b.id, nome: b.nome })]);
      const res = await request(app).post(`/usuarios/${b.id}/bloquear`).set(ha).expect(200);
      expect(res.body.bloqueado).toBe(false);
      await request(app).post("/mensagens").set(ha).send({ destinatario_id: b.id, mensagem: "oi de novo" }).expect(201);
    });

    it("não bloqueia a si mesmo nem usuário inexistente", async () => {
      const a = await createTestUser(); const ha = await authHeader(a);
      await request(app).post(`/usuarios/${a.id}/bloquear`).set(ha).expect(400);
      await request(app).post("/usuarios/999999/bloquear").set(ha).expect(404);
    });

    it("bloqueio impede notificações entre os dois", async () => {
      const a = await createTestUser(); const b = await createTestUser();
      const postA = await createPost(a.id);
      await testPool.query("INSERT INTO bloqueios (bloqueador_id, bloqueado_id) VALUES ($1, $2)", [a.id, b.id]);
      await request(app).post(`/posts/${postA.id}/like`).set(await authHeader(b)).expect(200);
      expect((await testPool.query("SELECT count(*)::int n FROM notificacoes")).rows[0].n).toBe(0);
    });
  });
});
