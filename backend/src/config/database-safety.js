const NON_PRODUCTION_DATABASES = new Set(["postfan_dev", "postfan_test"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function parseDatabaseUrl(rawUrl = process.env.DATABASE_URL) {
  if (!rawUrl) {
    throw new Error("DATABASE_URL nao configurada.");
  }

  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL invalida.");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL deve utilizar PostgreSQL.");
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (!databaseName) {
    throw new Error("DATABASE_URL nao informa o nome do banco.");
  }

  return {
    databaseName,
    hostname: url.hostname,
    port: url.port || "5432",
    url,
  };
}

function assertNonProductionDatabase(operation, rawUrl) {
  const context = parseDatabaseUrl(rawUrl);

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${operation} bloqueado: NODE_ENV=production.`);
  }

  if (!NON_PRODUCTION_DATABASES.has(context.databaseName)) {
    throw new Error(
      `${operation} bloqueado: banco '${context.databaseName}' nao autorizado.`,
    );
  }

  return context;
}

function assertLocalDevelopmentDatabase(operation, rawUrl) {
  const context = assertNonProductionDatabase(operation, rawUrl);

  if (context.databaseName !== "postfan_dev") {
    throw new Error(`${operation} exige o banco postfan_dev.`);
  }

  if (!LOCAL_HOSTS.has(context.hostname)) {
    throw new Error(`${operation} exige um PostgreSQL local.`);
  }

  return context;
}

function assertTestDatabase(operation, rawUrl) {
  const context = parseDatabaseUrl(rawUrl);

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${operation} bloqueado: NODE_ENV=production.`);
  }

  if (process.env.NODE_ENV !== "test") {
    throw new Error(`${operation} exige NODE_ENV=test.`);
  }

  if (context.databaseName !== "postfan_test") {
    throw new Error(
      `${operation} bloqueado: testes exigem o banco postfan_test.`,
    );
  }

  return context;
}

module.exports = {
  assertLocalDevelopmentDatabase,
  assertNonProductionDatabase,
  assertTestDatabase,
  parseDatabaseUrl,
};
