// Define o papel de um usuário (usuario | moderador | admin).
// Uso: node scripts/set-user-role.js <email> <papel> [--confirmar]
// Sem --confirmar, apenas mostra a conta encontrada e o que seria alterado.
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), override: false, quiet: true });
const prisma = require("../src/lib/prisma");
const { normalizeEmail } = require("../src/modules/auth/email");

const PAPEIS = new Set(["usuario", "moderador", "admin"]);

async function main() {
  const [emailArg, papel] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const confirmar = process.argv.includes("--confirmar");
  const email = normalizeEmail(emailArg);
  if (!email || !PAPEIS.has(papel)) {
    console.error("Uso: node scripts/set-user-role.js <email> <usuario|moderador|admin> [--confirmar]");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.usuario.findUnique({ where: { email }, select: { id: true, nome: true, papel: true } });
  if (!user) {
    console.error("Nenhuma conta encontrada com esse email.");
    process.exitCode = 1;
    return;
  }

  console.log(`Conta: #${user.id} ${user.nome} — papel atual: ${user.papel} → novo papel: ${papel}`);
  if (!confirmar) {
    console.log("Nada foi alterado. Rode novamente com --confirmar para aplicar.");
    return;
  }
  await prisma.usuario.update({ where: { id: user.id }, data: { papel } });
  console.log("Papel atualizado.");
}

main()
  .catch((error) => {
    console.error("Falha:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
