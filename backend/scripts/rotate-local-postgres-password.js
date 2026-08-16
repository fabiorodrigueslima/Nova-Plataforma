const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");
const { assertLocalDevelopmentDatabase } = require("../src/config/database-safety");

const envPath = path.resolve(__dirname, "../.env");

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  const originalText = fs.readFileSync(envPath, "utf8");
  const parsed = dotenv.parse(originalText);
  const context = assertLocalDevelopmentDatabase(
    "Rotacao de credencial local",
    parsed.DATABASE_URL,
  );
  const role = decodeURIComponent(context.url.username);

  if (!role) {
    throw new Error("DATABASE_URL nao informa o usuario PostgreSQL.");
  }

  const oldPassword = decodeURIComponent(context.url.password);
  const newPassword = crypto.randomBytes(32).toString("base64url");
  const newUrl = new URL(context.url.toString());
  newUrl.password = newPassword;

  const admin = new Client({ connectionString: parsed.DATABASE_URL });
  let databaseChanged = false;

  try {
    await admin.connect();
    await admin.query(
      `ALTER ROLE ${quoteIdentifier(role)} PASSWORD ${quoteLiteral(newPassword)}`,
    );
    databaseChanged = true;

    const verification = new Client({ connectionString: newUrl.toString() });
    await verification.connect();
    await verification.query("SELECT 1");
    await verification.end();

    const oldCredential = new Client({ connectionString: parsed.DATABASE_URL });
    let oldRejected = false;
    try {
      await oldCredential.connect();
    } catch {
      oldRejected = true;
    } finally {
      await oldCredential.end().catch(() => undefined);
    }
    if (!oldRejected) {
      throw new Error("A credencial anterior ainda foi aceita.");
    }

    if (!/^DATABASE_URL=.*$/m.test(originalText)) {
      throw new Error("Linha DATABASE_URL nao encontrada no arquivo .env.");
    }
    const updatedText = originalText.replace(
      /^DATABASE_URL=.*$/m,
      `DATABASE_URL=${newUrl.toString()}`,
    );
    const temporaryPath = `${envPath}.rotation.tmp`;
    fs.writeFileSync(temporaryPath, updatedText, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporaryPath, envPath);

    console.log("Credencial PostgreSQL local rotacionada e validada.");
  } catch (error) {
    if (databaseChanged) {
      await admin
        .query(`ALTER ROLE ${quoteIdentifier(role)} PASSWORD ${quoteLiteral(oldPassword)}`)
        .catch(() => undefined);
    }
    throw error;
  } finally {
    await admin.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`Falha na rotacao: ${error.message}`);
  process.exitCode = 1;
});
