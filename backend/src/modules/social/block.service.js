const prisma = require("../../lib/prisma");

// O bloqueio vale nos dois sentidos: quem bloqueia e quem foi bloqueado deixam
// de interagir (feed, comentários, mensagens, seguir e notificações).

async function blockedIdsFor(usuarioId) {
  if (!usuarioId) return [];
  const rows = await prisma.bloqueio.findMany({
    where: { OR: [{ bloqueadorId: usuarioId }, { bloqueadoId: usuarioId }] },
    select: { bloqueadorId: true, bloqueadoId: true },
  });
  return [...new Set(rows.map((row) => (row.bloqueadorId === usuarioId ? row.bloqueadoId : row.bloqueadorId)))];
}

async function isBlockedEitherWay(a, b) {
  if (!a || !b || a === b) return false;
  const row = await prisma.bloqueio.findFirst({
    where: { OR: [{ bloqueadorId: a, bloqueadoId: b }, { bloqueadorId: b, bloqueadoId: a }] },
    select: { id: true },
  });
  return Boolean(row);
}

async function hasBlocked(bloqueadorId, bloqueadoId) {
  const row = await prisma.bloqueio.findUnique({
    where: { bloqueadorId_bloqueadoId: { bloqueadorId, bloqueadoId } },
    select: { id: true },
  });
  return Boolean(row);
}

async function toggleBlock(bloqueadorId, bloqueadoId) {
  if (bloqueadorId === bloqueadoId) return { status: "self" };
  const target = await prisma.usuario.findUnique({ where: { id: bloqueadoId }, select: { id: true } });
  if (!target) return { status: "not_found" };

  const key = { bloqueadorId_bloqueadoId: { bloqueadorId, bloqueadoId } };
  const existing = await prisma.bloqueio.findUnique({ where: key, select: { id: true } });
  if (existing) {
    await prisma.bloqueio.delete({ where: key });
    return { status: "ok", bloqueado: false };
  }

  await prisma.$transaction([
    prisma.bloqueio.create({ data: { bloqueadorId, bloqueadoId } }),
    // Bloquear desfaz qualquer relação de seguir entre os dois.
    prisma.seguidor.deleteMany({
      where: {
        OR: [
          { seguidorId: bloqueadorId, seguindoId: bloqueadoId },
          { seguidorId: bloqueadoId, seguindoId: bloqueadorId },
        ],
      },
    }),
  ]);
  return { status: "ok", bloqueado: true };
}

async function listBlocked(bloqueadorId) {
  const rows = await prisma.bloqueio.findMany({
    where: { bloqueadorId },
    orderBy: { criadoEm: "desc" },
    select: { criadoEm: true, bloqueado: { select: { id: true, nome: true, foto: true } } },
  });
  return rows.map((row) => ({ ...row.bloqueado, bloqueado_em: row.criadoEm }));
}

module.exports = { blockedIdsFor, hasBlocked, isBlockedEitherWay, listBlocked, toggleBlock };
