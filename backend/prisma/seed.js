const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const {
  assertNonProductionDatabase,
} = require("../src/config/database-safety");

const prisma = new PrismaClient();

async function main() {
  assertNonProductionDatabase("Seed", process.env.DATABASE_URL);

  const senha = await bcrypt.hash("PostFan-Dev-2026!", 12);

  const administrador = await prisma.usuario.upsert({
    where: { email: "admin.teste@postfan.local" },
    update: {},
    create: {
      nome: "Administrador Teste",
      email: "admin.teste@postfan.local",
      senha,
    },
  });

  const usuario = await prisma.usuario.upsert({
    where: { email: "usuario.teste@postfan.local" },
    update: {},
    create: {
      nome: "Usuario Teste",
      email: "usuario.teste@postfan.local",
      senha,
      bio: "Perfil ficticio para desenvolvimento local.",
    },
  });

  const grupo = await prisma.grupo.upsert({
    where: { codigoConvite: "DEV2026" },
    update: {},
    create: {
      donoId: administrador.id,
      nome: "Comunidade Teste",
      descricao: "Comunidade ficticia para validar a PostFan em desenvolvimento.",
      categoria: "Desenvolvimento",
      codigoConvite: "DEV2026",
      membros: {
        create: [
          { usuarioId: administrador.id, papel: "admin" },
          { usuarioId: usuario.id, papel: "membro" },
        ],
      },
    },
  });

  const postExistente = await prisma.post.findFirst({
    where: { usuarioId: usuario.id, tema: "Desenvolvimento" },
  });

  if (!postExistente) {
    await prisma.post.create({
      data: {
        usuarioId: usuario.id,
        conteudo: "Este e um post ficticio criado pelo seed de desenvolvimento.",
        tema: "Desenvolvimento",
      },
    });
  }

  console.log(`Seed concluido para a comunidade ${grupo.nome}.`);
}

main()
  .catch((error) => {
    console.error("Falha ao executar seed:", error.code || error.name);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
