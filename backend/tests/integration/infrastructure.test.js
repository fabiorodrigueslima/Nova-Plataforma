const request = require("supertest");
const app = require("../../server");
const appPool = require("../../db");
const prisma = require("../../src/lib/prisma");
const { assertTestDatabase } = require("../../src/config/database-safety");

describe("infraestrutura de testes", () => {
  afterAll(async () => {
    await prisma.$disconnect();
    await appPool.end();
  });

  it("responde ao health check sem abrir porta HTTP", async () => {
    const response = await request(app).get("/healthz").expect(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("usa fisicamente o banco postfan_test", async () => {
    const rows = await prisma.$queryRaw`SELECT current_database() AS database`;
    expect(rows[0].database).toBe("postfan_test");
  });

  it("bloqueia postfan_dev para operacoes de teste", () => {
    expect(() =>
      assertTestDatabase(
        "Limpeza automatizada",
        "postgresql://user:secret@localhost:5432/postfan_dev",
      ),
    ).toThrow(/postfan_test/);
  });

  it("bloqueia operacoes de teste em NODE_ENV=production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(() =>
        assertTestDatabase("Limpeza automatizada", process.env.DATABASE_URL),
      ).toThrow(/production/);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
