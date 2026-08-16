const { createTestUser } = require("../fixtures/factories");
const { resetTestDatabase, testPool } = require("../helpers/database");

describe("constraints reais do PostgreSQL", () => {
  beforeEach(resetTestDatabase);
  afterEach(resetTestDatabase);
  afterAll(async () => testPool.end());

  it("rejeita emails iguais com diferenca apenas de caixa", async () => {
    await createTestUser({ email: "Teste@Test.local" });
    await expect(
      createTestUser({ email: "teste@test.local" }),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("rejeita auto-seguimento", async () => {
    const user = await createTestUser();
    await expect(
      testPool.query(
        "INSERT INTO seguidores (seguidor_id, seguindo_id) VALUES ($1, $1)",
        [user.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("rejeita mensagem privada para o proprio remetente", async () => {
    const user = await createTestUser();
    await expect(
      testPool.query(
        "INSERT INTO mensagens_privadas (remetente_id, destinatario_id, mensagem) VALUES ($1, $1, 'teste')",
        [user.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("rejeita post sem texto e sem arquivo", async () => {
    const user = await createTestUser();
    await expect(
      testPool.query(
        "INSERT INTO posts (usuario_id, conteudo, imagem) VALUES ($1, '   ', NULL)",
        [user.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
