require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool
  .connect()
  .then(() => console.log("✅ PostgreSQL conectado no Render"))
  .catch((err) => console.log("❌ Erro PostgreSQL", err));

module.exports = pool;
