const { Prisma } = require("@prisma/client");
const prisma = require("../../lib/prisma");
const { presentAuthenticatedUser } = require("./auth.presenter");
const { hashToken, revokeAllUserSessions } = require("./session.service");

const authenticatedUserSelect = Object.freeze({
  id: true,
  nome: true,
  email: true,
  foto: true,
  bio: true,
  essenciaRepresenta: true,
  essenciaTema: true,
  essenciaFrase: true,
  abertoPara: true,
});

const loginUserSelect = Object.freeze({
  ...authenticatedUserSelect,
  senha: true,
  googleId: true,
  provider: true,
});

function isUniqueConstraintError(error) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

async function emailExists(email) {
  return Boolean(
    await prisma.usuario.findUnique({ where: { email }, select: { id: true } }),
  );
}

async function createLocalUser({ nome, email, passwordHash, photo }) {
  const user = await prisma.usuario.create({
    data: { nome, email, senha: passwordHash, foto: photo },
    select: authenticatedUserSelect,
  });
  return presentAuthenticatedUser(user);
}

async function findLoginUser(email) {
  const user = await prisma.usuario.findUnique({
    where: { email },
    select: loginUserSelect,
  });
  if (!user) return null;
  return {
    passwordHash: user.senha,
    user: presentAuthenticatedUser(user),
  };
}

async function findOrCreateGoogleUser({ email, googleId, name, photo }) {
  const existing = await prisma.usuario.findUnique({
    where: { email },
    select: loginUserSelect,
  });

  if (existing) {
    const user = await prisma.usuario.update({
      where: { id: existing.id },
      data: {
        googleId: existing.googleId || googleId,
        provider: existing.senha ? existing.provider : "google",
        foto: existing.foto || photo,
      },
      select: authenticatedUserSelect,
    });
    return presentAuthenticatedUser(user);
  }

  const user = await prisma.usuario.create({
    data: {
      nome: name,
      email,
      senha: null,
      foto: photo,
      googleId,
      provider: "google",
    },
    select: authenticatedUserSelect,
  });
  return presentAuthenticatedUser(user);
}

async function createPasswordRecovery(email, token, expiresAt) {
  const user = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return false;

  await prisma.usuario.update({
    where: { id: user.id },
    data: { tokenRecuperacao: hashToken(token), tokenExpira: expiresAt },
    select: { id: true },
  });
  return true;
}

async function resetPasswordWithToken(token, passwordHash, now = new Date()) {
  return prisma.$transaction(async (transaction) => {
    const tokenHash = hashToken(token);
    const user = await transaction.usuario.findFirst({
      where: { tokenRecuperacao: tokenHash },
      select: { id: true, tokenExpira: true },
    });
    if (!user) return { status: "invalid" };
    if (!user.tokenExpira || now > user.tokenExpira) return { status: "expired" };

    const updated = await transaction.usuario.updateMany({
      where: { id: user.id, tokenRecuperacao: tokenHash },
      data: {
        senha: passwordHash,
        tokenRecuperacao: null,
        tokenExpira: null,
      },
    });
    if (updated.count !== 1) return { status: "invalid" };
    await revokeAllUserSessions(user.id, now, transaction);
    return { status: "updated" };
  });
}

module.exports = {
  createLocalUser,
  createPasswordRecovery,
  emailExists,
  findLoginUser,
  findOrCreateGoogleUser,
  isUniqueConstraintError,
  resetPasswordWithToken,
};
