const prisma = require("../../lib/prisma");
const {
  privateUserSelect,
  publicUserSelect,
  userCardFields,
} = require("./user.select");
const {
  presentPrivateUser,
  presentPublicUser,
  presentUserCard,
} = require("./user.presenter");

function cardSelect(viewerId) {
  return {
    ...userCardFields,
    seguidores: {
      where: { seguidorId: viewerId },
      select: { id: true },
      take: 1,
    },
  };
}

async function touchLastAccess(id) {
  await prisma.usuario.updateMany({
    where: { id },
    data: { ultimoAcesso: new Date() },
  });
}

async function findPrivateProfile(id) {
  const user = await prisma.usuario.findUnique({
    where: { id },
    select: privateUserSelect,
  });
  return user ? presentPrivateUser(user) : null;
}

async function findPublicProfile(id) {
  const user = await prisma.usuario.findUnique({
    where: { id },
    select: publicUserSelect,
  });
  return user ? presentPublicUser(user) : null;
}

async function updateProfile(id, input) {
  const current = await prisma.usuario.findUnique({
    where: { id },
    select: privateUserSelect,
  });
  if (!current) return null;

  const optionalText = (field, currentValue) =>
    Object.prototype.hasOwnProperty.call(input, field)
      ? String(input[field] ?? "").trim() || null
      : currentValue;
  const nome = Object.prototype.hasOwnProperty.call(input, "nome")
    ? String(input.nome ?? "").trim()
    : current.nome;
  if (!nome) return { status: "invalid_name" };

  const user = await prisma.usuario.update({
    where: { id },
    data: {
      nome: nome.slice(0, 150),
      bio: optionalText("bio", current.bio)?.slice(0, 220) ?? null,
      foto: input.foto ?? current.foto,
      essenciaRepresenta: optionalText("essencia_representa", current.essenciaRepresenta),
      essenciaTema: optionalText("essencia_tema", current.essenciaTema),
      essenciaFrase: optionalText("essencia_frase", current.essenciaFrase),
      abertoPara: optionalText("aberto_para", current.abertoPara),
    },
    select: privateUserSelect,
  });
  return presentPrivateUser(user);
}

async function deleteAccount(id, reason) {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.usuario.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true },
    });
    if (!user) return false;

    await transaction.exclusaoConta.create({
      data: {
        usuarioId: user.id,
        nome: user.nome,
        email: user.email,
        motivo: reason?.trim() || null,
        status: "concluida",
        concluidoEm: new Date(),
      },
    });
    await transaction.usuario.delete({ where: { id } });
    return true;
  });
}

async function listSuggestions(viewerId) {
  const users = await prisma.usuario.findMany({
    where: { id: { not: viewerId } },
    orderBy: { id: "desc" },
    take: 20,
    select: cardSelect(viewerId),
  });
  return users.map((user) => presentUserCard(user, user.seguidores.length > 0));
}

async function listOnlineUsers(viewerId) {
  const users = await prisma.usuario.findMany({
    where: {
      id: { not: viewerId },
      ultimoAcesso: { gt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    orderBy: { ultimoAcesso: "desc" },
    take: 8,
    select: cardSelect(viewerId),
  });
  return users.map((user) => presentUserCard(user, user.seguidores.length > 0));
}

async function listFollowers(viewerId) {
  const relations = await prisma.seguidor.findMany({
    where: { seguindoId: viewerId },
    orderBy: { criadoEm: "desc" },
    take: 12,
    select: { seguidor: { select: cardSelect(viewerId) } },
  });
  return relations.map(({ seguidor }) =>
    presentUserCard(seguidor, seguidor.seguidores.length > 0),
  );
}

async function listFollowing(viewerId) {
  const relations = await prisma.seguidor.findMany({
    where: { seguidorId: viewerId },
    orderBy: { criadoEm: "desc" },
    take: 12,
    select: { seguindo: { select: userCardFields } },
  });
  return relations.map(({ seguindo }) => presentUserCard(seguindo, true));
}

module.exports = {
  deleteAccount,
  findPrivateProfile,
  findPublicProfile,
  listFollowers,
  listFollowing,
  listOnlineUsers,
  listSuggestions,
  touchLastAccess,
  updateProfile,
};
