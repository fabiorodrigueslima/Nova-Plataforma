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
  // O pooler do Supabase (plano gratuito) aceita poucas conexões simultâneas;
  // o Prisma usa outras, então mantemos este pool pequeno.
  max: Number(process.env.PG_POOL_MAX) || 5,
  idleTimeoutMillis: 30000,
});

pool
  .query("SELECT 1")
  .then(() => console.log("✅ PostgreSQL conectado"))
  .catch((err) => console.error("❌ Erro PostgreSQL:", err.code || err.message));

module.exports = pool;
