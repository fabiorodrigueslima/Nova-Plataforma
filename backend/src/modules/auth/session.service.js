const crypto = require("crypto");
const prisma = require("../../lib/prisma");

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_BYTES = 32;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function csrfTokenFor(sessionToken, secret) {
  return crypto.createHmac("sha256", secret).update(sessionToken).digest("base64url");
}

function csrfMatches(actual, expected) {
  if (!actual || !expected) return false;
  const left = Buffer.from(String(actual));
  const right = Buffer.from(String(expected));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function createSession(usuarioId, userAgent, now = new Date()) {
  const token = crypto.randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  const expiraEm = new Date(now.getTime() + SESSION_TTL_MS);
  const session = await prisma.session.create({
    data: {
      usuarioId,
      tokenHash: hashToken(token),
      expiraEm,
      userAgent: String(userAgent || "").slice(0, 300) || null,
    },
    select: { id: true, expiraEm: true },
  });
  return { ...session, token };
}

async function findActiveSession(token, now = new Date()) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { select: { id: true, nome: true, email: true } } },
  });
  if (!session || session.revogadoEm || session.expiraEm <= now) return null;
  return session;
}

async function revokeSession(id, now = new Date()) {
  return prisma.session.updateMany({
    where: { id, revogadoEm: null },
    data: { revogadoEm: now },
  });
}

async function revokeAllUserSessions(usuarioId, now = new Date(), transaction = prisma) {
  return transaction.session.updateMany({
    where: { usuarioId, revogadoEm: null },
    data: { revogadoEm: now },
  });
}

module.exports = {
  SESSION_TTL_MS,
  createSession,
  csrfMatches,
  csrfTokenFor,
  findActiveSession,
  hashToken,
  revokeAllUserSessions,
  revokeSession,
};
