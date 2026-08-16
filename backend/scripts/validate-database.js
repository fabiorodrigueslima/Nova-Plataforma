const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

const { Client } = require("pg");
const {
  assertNonProductionDatabase,
} = require("../src/config/database-safety");

const expectedTables = [
  "comentarios",
  "compartilhamentos",
  "curtidas",
  "denuncias",
  "exclusoes_conta",
  "grupo_membros",
  "grupo_mensagens",
  "grupo_solicitacoes",
  "grupos",
  "mensagens_privadas",
  "posts",
  "seguidores",
  "usuarios",
];

const expectedChecks = [
  "denuncias_alvo_check",
  "denuncias_status_check",
  "exclusoes_conta_status_check",
  "grupo_membros_papel_check",
  "grupo_solicitacoes_status_check",
  "grupos_tipo_check",
  "mensagens_privadas_destinatarios_distintos_check",
  "posts_conteudo_ou_arquivo_check",
  "seguidores_nao_seguir_si_check",
  "usuarios_metodo_autenticacao_check",
  "usuarios_provider_check",
];

function assertSameMembers(actual, expected, label) {
  const missing = expected.filter((item) => !actual.includes(item));
  const unexpected = actual.filter((item) => !expected.includes(item));

  if (missing.length || unexpected.length) {
    throw new Error(
      `${label} divergentes. Ausentes: ${missing.join(", ") || "nenhum"}; inesperados: ${unexpected.join(", ") || "nenhum"}.`,
    );
  }
}

async function main() {
  assertNonProductionDatabase("Validacao estrutural do banco");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const database = await client.query(
      "SELECT current_database() AS database, current_setting('server_version') AS version",
    );
    const tables = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      ORDER BY tablename
    `);
    const primaryKeys = await client.query(`
      SELECT conrelid::regclass::text AS tabela, conname
      FROM pg_constraint
      WHERE contype = 'p'
        AND connamespace = 'public'::regnamespace
        AND conrelid <> 'public._prisma_migrations'::regclass
      ORDER BY tabela
    `);
    const foreignKeys = await client.query(`
      SELECT
        conrelid::regclass::text AS tabela,
        conname,
        confdeltype
      FROM pg_constraint
      WHERE contype = 'f' AND connamespace = 'public'::regnamespace
      ORDER BY tabela, conname
    `);
    const checks = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE contype = 'c' AND connamespace = 'public'::regnamespace
      ORDER BY conname
    `);
    const indexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY indexname
    `);
    const seed = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM usuarios) AS usuarios,
        (SELECT COUNT(*)::int FROM grupos) AS grupos,
        (SELECT COUNT(*)::int FROM posts) AS posts
    `);

    const tableNames = tables.rows.map((row) => row.tablename);
    const checkNames = checks.rows.map((row) => row.conname);
    assertSameMembers(tableNames, expectedTables, "Tabelas");
    assertSameMembers(checkNames, expectedChecks, "CHECK constraints");

    if (primaryKeys.rowCount !== expectedTables.length) {
      throw new Error(`Esperadas ${expectedTables.length} PKs; encontradas ${primaryKeys.rowCount}.`);
    }

    if (foreignKeys.rowCount !== 21) {
      throw new Error(`Esperadas 21 FKs; encontradas ${foreignKeys.rowCount}.`);
    }

    console.log(
      JSON.stringify(
        {
          database: database.rows[0],
          tables: tableNames,
          primaryKeys: primaryKeys.rowCount,
          foreignKeys: foreignKeys.rowCount,
          indexes: indexes.rowCount,
          checks: checkNames,
          nativeEnums: 0,
          seed: seed.rows[0],
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Validacao estrutural falhou:", error.message);
  process.exitCode = 1;
});
