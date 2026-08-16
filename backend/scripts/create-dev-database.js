const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");
const {
  assertLocalDevelopmentDatabase,
} = require("../src/config/database-safety");

const envPath = path.resolve(__dirname, "../.env");
const env = dotenv.parse(fs.readFileSync(envPath));
const { databaseName, url: targetUrl } = assertLocalDevelopmentDatabase(
  "Criacao do banco de desenvolvimento",
  env.DATABASE_URL,
);

const adminUrl = new URL(targetUrl);
adminUrl.pathname = "/postgres";

async function main() {
  const client = new Client({ connectionString: adminUrl.toString(), ssl: false });
  await client.connect();

  try {
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );

    if (existing.rowCount === 0) {
      await client.query("CREATE DATABASE postfan_dev");
      console.log("Banco postfan_dev criado.");
      return;
    }

    console.log("Banco postfan_dev ja existe.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Falha ao preparar postfan_dev:", error.code || error.name);
  process.exitCode = 1;
});
