const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");
const { Client } = require("pg");
const {
  assertLocalDevelopmentDatabase,
  assertTestDatabase,
} = require("../src/config/database-safety");

const backendDir = path.resolve(__dirname, "..");
const testEnvPath = path.join(backendDir, ".env.test");

function readUrlFromTestEnvironment() {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  if (!fs.existsSync(testEnvPath)) return null;
  return dotenv.parse(fs.readFileSync(testEnvPath)).DATABASE_URL_TEST;
}

async function createLocalTestDatabase() {
  const devEnv = dotenv.parse(fs.readFileSync(path.join(backendDir, ".env")));
  const dev = assertLocalDevelopmentDatabase(
    "Criacao do banco de testes",
    devEnv.DATABASE_URL,
  );
  const adminUrl = new URL(dev.url);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const client = new Client({ connectionString: adminUrl.toString(), ssl: false });
  await client.connect();
  try {
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'postfan_test'",
    );
    if (existing.rowCount === 0) {
      await client.query("CREATE DATABASE postfan_test");
    }
  } finally {
    await client.end();
  }

  const testUrl = new URL(dev.url);
  testUrl.pathname = "/postfan_test";
  fs.writeFileSync(
    testEnvPath,
    `# Arquivo local ignorado pelo Git. Nao compartilhe credenciais.\nDATABASE_URL_TEST=${testUrl.toString()}\nNODE_ENV=test\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  return testUrl.toString();
}

async function main() {
  process.env.NODE_ENV = "test";
  const testUrl = readUrlFromTestEnvironment() || (await createLocalTestDatabase());
  assertTestDatabase("Preparacao de testes", testUrl);

  const prismaCli = require.resolve("prisma/build/index.js");
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: testUrl, NODE_ENV: "test" },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("Prisma Migrate nao conseguiu preparar postfan_test.");
  }
  console.log("postfan_test preparado exclusivamente pelas migrations.");
}

main().catch((error) => {
  console.error(`Falha ao preparar testes: ${error.message}`);
  process.exitCode = 1;
});
