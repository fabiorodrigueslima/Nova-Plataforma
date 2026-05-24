const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.local"),
  override: false,
  quiet: true,
});

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  override: false,
  quiet: true,
});

require("dotenv").config({ quiet: true });

const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL precisa estar configurado no ambiente.");
}

const usaSsl =
  /sslmode=require/i.test(databaseUrl) ||
  (!databaseUrl.includes("localhost") && !databaseUrl.includes("127.0.0.1"));

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: usaSsl ? { rejectUnauthorized: false } : false,
});

pool
  .connect()
  .then(() => console.log("✅ PostgreSQL conectado no Render"))
  .catch((err) => console.log("❌ Erro PostgreSQL", err));

module.exports = pool;
