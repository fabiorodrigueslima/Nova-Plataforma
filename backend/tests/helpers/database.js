const { Pool } = require("pg");
const { assertTestDatabase } = require("../../src/config/database-safety");

assertTestDatabase("Conexao dos testes", process.env.DATABASE_URL);

const testPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const DOMAIN_TABLES = [
  "sessoes",
  "notificacoes",
  "grupo_solicitacoes",
  "grupo_mensagens",
  "grupo_membros",
  "grupos",
  "mensagens_privadas",
  "denuncias",
  "compartilhamentos",
  "comentarios",
  "curtidas",
  "seguidores",
  "posts",
  "exclusoes_conta",
  "usuarios",
];

async function resetTestDatabase() {
  assertTestDatabase("Limpeza dos testes", process.env.DATABASE_URL);
  await testPool.query(
    `TRUNCATE TABLE ${DOMAIN_TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}

module.exports = { DOMAIN_TABLES, resetTestDatabase, testPool };
