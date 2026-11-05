const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

// Limita as conexões do Prisma para caber no pooler do Supabase junto com o pool do pg.
function urlComLimiteDeConexoes(url) {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=${Number(process.env.PRISMA_CONNECTION_LIMIT) || 5}`;
}

const prisma =
  globalForPrisma.__postfanPrisma ||
  new PrismaClient({
    datasourceUrl: urlComLimiteDeConexoes(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__postfanPrisma = prisma;
}

module.exports = prisma;
