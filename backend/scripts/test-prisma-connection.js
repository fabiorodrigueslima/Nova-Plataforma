const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

const prisma = require("../src/lib/prisma");
const {
  assertNonProductionDatabase,
} = require("../src/config/database-safety");

async function main() {
  assertNonProductionDatabase("Teste de conexao Prisma");
  await prisma.$queryRaw`SELECT 1`;
  console.log("Conexao Prisma/PostgreSQL validada.");
}

main()
  .catch((error) => {
    console.error("Falha ao conectar ao PostgreSQL via Prisma:", error.code || error.name);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
