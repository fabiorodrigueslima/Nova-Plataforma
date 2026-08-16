const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const { Client } = require("pg");
const { assertNonProductionDatabase } = require("../src/config/database-safety");

require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const port = 5099;
const databaseUrl = process.env.DATABASE_URL;
assertNonProductionDatabase("Teste de inicializacao sem DDL", databaseUrl);

async function schemaFingerprint() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT kind, name, definition
      FROM (
        SELECT 'column' AS kind,
          table_name || '.' || column_name AS name,
          data_type || ':' || is_nullable || ':' || COALESCE(column_default, '') AS definition
        FROM information_schema.columns
        WHERE table_schema = 'public'
        UNION ALL
        SELECT 'constraint', conname, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
        UNION ALL
        SELECT 'index', indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
      ) catalog
      ORDER BY kind, name, definition
    `);
    return crypto.createHash("sha256").update(JSON.stringify(result.rows)).digest("hex");
  } finally {
    await client.end();
  }
}

async function waitForHealth(child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Servidor encerrou antes do health check (codigo ${child.exitCode}).`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {
      // O servidor ainda esta iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Servidor nao respondeu ao health check.");
}

async function main() {
  const before = await schemaFingerprint();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth(child);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }

  const after = await schemaFingerprint();
  if (before !== after) {
    throw new Error("O catalogo PostgreSQL mudou durante a inicializacao.");
  }
  console.log("Inicializacao: health check OK e catalogo PostgreSQL inalterado.");
}

main().catch((error) => {
  console.error(`Falha no teste de inicializacao: ${error.message}`);
  process.exitCode = 1;
});
