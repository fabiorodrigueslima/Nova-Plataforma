const request = require("supertest");
const app = require("../../server");
const appPool = require("../../db");
const prisma = require("../../src/lib/prisma");
const { createTestUser } = require("../fixtures/factories");
const { authHeader } = require("../helpers/auth");
const { resetTestDatabase, testPool } = require("../helpers/database");

async function abrirDebate(autor, extra = {}) {
  const res = await request(app)
    .post("/posts")
    .set(await authHeader(autor))
    .send({ tipo: "debate", conteudo: "O home office deve ser o padrão?", tema: "Trabalho", lado_a: "Sim", lado_b: "Não", ...extra });
  return res;
}

describe("debate estruturado", () => {
  beforeEach(resetTestDatabase);
  afterEach(resetTestDatabase);
  afterAll(async () => { await prisma.$disconnect(); await appPool.end(); await testPool.end(); });

  it("cria debate com dois lados e aparece no feed com placar zerado", async () => {
    const autor = await createTestUser();
    const res = await abrirDebate(autor);
    expect(res.status).toBe(201);
    expect(res.body.post).toMatchObject({ tipo: "debate", lado_a: "Sim", lado_b: "Não", debate: { total_a: 0, total_b: 0, minha_posicao: null, total_argumentos: 0 } });
    const feed = await request(app).get("/posts").set(await authHeader(autor)).expect(200);
    expect(feed.body.items[0]).toMatchObject({ tipo: "debate", debate: { total_a: 0 } });
  });

  it("usa lados padrão e rejeita debate inválido", async () => {
    const autor = await createTestUser();
    const padrao = await abrirDebate(autor, { lado_a: "", lado_b: "" });
    expect(padrao.body.post).toMatchObject({ lado_a: "A favor", lado_b: "Contra" });
    expect((await abrirDebate(autor, { conteudo: "  " })).status).toBe(400);
    expect((await abrirDebate(autor, { lado_a: "Sim", lado_b: "sim" })).status).toBe(400);
    expect((await abrirDebate(autor, { conteudo: "x".repeat(301) })).status).toBe(400);
  });

  it("post comum continua sendo do tipo post", async () => {
    const autor = await createTestUser();
    const res = await request(app).post("/posts").set(await authHeader(autor)).send({ conteudo: "Post normal" }).expect(201);
    expect(res.body.post.tipo).toBe("post");
    expect(res.body.post.debate).toBeUndefined();
  });

  it("escolher lado atualiza o placar; só argumenta quem escolheu lado", async () => {
    const autor = await createTestUser(); const ana = await createTestUser(); const beto = await createTestUser();
    const { body: { post } } = await abrirDebate(autor);
    const ha = await authHeader(ana);
    await request(app).post(`/debates/${post.id}/argumentos`).set(ha).send({ texto: "Mais produtividade." }).expect(409);
    await request(app).post(`/debates/${post.id}/posicao`).set(ha).send({ lado: "x" }).expect(400);
    const pos = await request(app).post(`/debates/${post.id}/posicao`).set(ha).send({ lado: "a" }).expect(200);
    expect(pos.body).toMatchObject({ mudou: false, debate: { total_a: 1, total_b: 0, minha_posicao: "a" } });
    await request(app).post(`/debates/${post.id}/posicao`).set(await authHeader(beto)).send({ lado: "b" }).expect(200);

    const arg = await request(app).post(`/debates/${post.id}/argumentos`).set(ha).send({ texto: "  Mais produtividade e menos trânsito.  " }).expect(201);
    expect(arg.body.argumentos[0]).toMatchObject({ lado: "a", texto: "Mais produtividade e menos trânsito.", meu: true, votos: 0 });

    const notif = await testPool.query("SELECT tipo FROM notificacoes WHERE destinatario_id = $1", [autor.id]);
    expect(notif.rows.map((r) => r.tipo)).toEqual(["argumento"]);
  });

  it("voto do outro lado vale o dobro no ranking", async () => {
    const autor = await createTestUser(); const a1 = await createTestUser(); const a2 = await createTestUser();
    const b1 = await createTestUser(); const b2 = await createTestUser();
    const { body: { post } } = await abrirDebate(autor);
    for (const [u, lado] of [[a1, "a"], [a2, "a"], [b1, "b"], [b2, "b"]]) {
      await request(app).post(`/debates/${post.id}/posicao`).set(await authHeader(u)).send({ lado }).expect(200);
    }
    await request(app).post(`/debates/${post.id}/argumentos`).set(await authHeader(a1)).send({ texto: "Argumento X" }).expect(201);
    await request(app).post(`/debates/${post.id}/argumentos`).set(await authHeader(a2)).send({ texto: "Argumento Y" }).expect(201);
    const { body } = await request(app).get(`/debates/${post.id}`).set(await authHeader(b1)).expect(200);
    const x = body.argumentos.find((g) => g.texto === "Argumento X");
    const y = body.argumentos.find((g) => g.texto === "Argumento Y");

    // X: 1 voto do próprio lado (a2) => 1 ponto. Y: 1 voto do outro lado (b1) => 2 pontos.
    await request(app).post(`/argumentos/${x.id}/voto`).set(await authHeader(a2)).expect(200);
    await request(app).post(`/argumentos/${y.id}/voto`).set(await authHeader(b1)).expect(200);
    const ranking = await request(app).get(`/debates/${post.id}`).set(await authHeader(b2)).expect(200);
    expect(ranking.body.argumentos.map((g) => [g.texto, g.pontuacao, g.votos_outro_lado])).toEqual([["Argumento Y", 2, 1], ["Argumento X", 1, 0]]);

    await request(app).post(`/argumentos/${x.id}/voto`).set(await authHeader(a1)).expect(400);
    const desfaz = await request(app).post(`/argumentos/${y.id}/voto`).set(await authHeader(b1)).expect(200);
    expect(desfaz.body.votei).toBe(false);
  });

  it("mudar de opinião registra a troca, credita o argumento e aparece nos selos", async () => {
    const autor = await createTestUser(); const ana = await createTestUser(); const beto = await createTestUser();
    const { body: { post } } = await abrirDebate(autor);
    const ha = await authHeader(ana); const hb = await authHeader(beto);
    await request(app).post(`/debates/${post.id}/posicao`).set(ha).send({ lado: "a" }).expect(200);
    await request(app).post(`/debates/${post.id}/posicao`).set(hb).send({ lado: "b" }).expect(200);
    const { body: { argumentos } } = await request(app).post(`/debates/${post.id}/argumentos`).set(hb).send({ texto: "Isolamento prejudica a carreira." }).expect(201);
    const argB = argumentos[0];

    // Não pode creditar argumento do lado que está deixando nem argumento próprio.
    await request(app).post(`/debates/${post.id}/argumentos`).set(ha).send({ texto: "Arg da Ana" }).expect(201);
    const argAna = (await request(app).get(`/debates/${post.id}`).set(ha)).body.argumentos.find((g) => g.meu);
    await request(app).post(`/debates/${post.id}/posicao`).set(ha).send({ lado: "b", argumento_id: argAna.id }).expect(400);

    const troca = await request(app).post(`/debates/${post.id}/posicao`).set(ha).send({ lado: "b", argumento_id: argB.id }).expect(200);
    expect(troca.body).toMatchObject({ mudou: true, debate: { total_a: 0, total_b: 2, minha_posicao: "b" } });

    const mudanca = (await testPool.query("SELECT de, para, argumento_id FROM mudancas_opiniao")).rows;
    expect(mudanca).toEqual([{ de: "a", para: "b", argumento_id: argB.id }]);
    const notif = await testPool.query("SELECT tipo FROM notificacoes WHERE destinatario_id = $1", [beto.id]);
    expect(notif.rows.map((r) => r.tipo)).toContain("convenceu");

    const statsAna = await request(app).get(`/perfil/stats/${ana.id}`).set(ha).expect(200);
    expect(statsAna.body.mudou_de_opiniao).toBe(1);
    const statsBeto = await request(app).get(`/perfil/stats/${beto.id}`).set(ha).expect(200);
    expect(statsBeto.body.pessoas_convencidas).toBe(1);

    const detalhe = await request(app).get(`/debates/${post.id}`).set(ha).expect(200);
    expect(detalhe.body.argumentos.find((g) => g.id === argB.id).convenceu).toBe(1);
  });

  it("trocar de lado sem indicar argumento também conta como mudança", async () => {
    const autor = await createTestUser(); const ana = await createTestUser();
    const { body: { post } } = await abrirDebate(autor);
    const ha = await authHeader(ana);
    await request(app).post(`/debates/${post.id}/posicao`).set(ha).send({ lado: "b" }).expect(200);
    const res = await request(app).post(`/debates/${post.id}/posicao`).set(ha).send({ lado: "a" }).expect(200);
    expect(res.body.mudou).toBe(true);
    const repetir = await request(app).post(`/debates/${post.id}/posicao`).set(ha).send({ lado: "a" }).expect(200);
    expect(repetir.body.mudou).toBe(false);
    expect((await testPool.query("SELECT count(*)::int n FROM mudancas_opiniao")).rows[0].n).toBe(1);
  });

  it("post comum não aceita posições; argumentos de bloqueados somem", async () => {
    const autor = await createTestUser(); const ana = await createTestUser(); const beto = await createTestUser();
    const comum = await request(app).post("/posts").set(await authHeader(autor)).send({ conteudo: "Normal" }).expect(201);
    await request(app).post(`/debates/${comum.body.post.id}/posicao`).set(await authHeader(ana)).send({ lado: "a" }).expect(404);
    await request(app).get(`/debates/${comum.body.post.id}`).set(await authHeader(ana)).expect(404);

    const { body: { post } } = await abrirDebate(autor);
    await request(app).post(`/debates/${post.id}/posicao`).set(await authHeader(beto)).send({ lado: "a" }).expect(200);
    await request(app).post(`/debates/${post.id}/argumentos`).set(await authHeader(beto)).send({ texto: "Arg do Beto" }).expect(201);
    await request(app).post(`/usuarios/${beto.id}/bloquear`).set(await authHeader(ana)).expect(200);
    const visao = await request(app).get(`/debates/${post.id}`).set(await authHeader(ana)).expect(200);
    expect(visao.body.argumentos).toEqual([]);
  });

  it("autor apaga o próprio argumento; outro usuário não; equipe pode", async () => {
    const autor = await createTestUser(); const ana = await createTestUser(); const mod = await createTestUser();
    await testPool.query("UPDATE usuarios SET papel = 'moderador' WHERE id = $1", [mod.id]);
    const { body: { post } } = await abrirDebate(autor);
    const ha = await authHeader(ana);
    await request(app).post(`/debates/${post.id}/posicao`).set(ha).send({ lado: "a" }).expect(200);
    const { body: { argumentos } } = await request(app).post(`/debates/${post.id}/argumentos`).set(ha).send({ texto: "Um" }).expect(201);
    await request(app).delete(`/argumentos/${argumentos[0].id}`).set(await authHeader(autor)).expect(403);
    await request(app).delete(`/argumentos/${argumentos[0].id}`).set(await authHeader(mod)).expect(200);
    await request(app).delete(`/argumentos/${argumentos[0].id}`).set(ha).expect(404);
  });

  it("argumento passa pela moderação de conteúdo", async () => {
    const autor = await createTestUser(); const ana = await createTestUser();
    const { body: { post } } = await abrirDebate(autor);
    const ha = await authHeader(ana);
    await request(app).post(`/debates/${post.id}/posicao`).set(ha).send({ lado: "a" }).expect(200);
    const res = await request(app).post(`/debates/${post.id}/argumentos`).set(ha).send({ texto: "vou te matar" }).expect(422);
    expect(res.body.codigo).toBe("CONTEUDO_BLOQUEADO");
  });
});
