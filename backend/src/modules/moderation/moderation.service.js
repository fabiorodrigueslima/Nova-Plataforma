const prisma = require("../../lib/prisma");
const { revokeAllUserSessions } = require("../auth/session.service");

const STAFF_ROLES = new Set(["admin", "moderador"]);
const ACOES = new Set(["remover_post", "suspender_usuario", "arquivar"]);
const STATUS_FILTRO = new Set(["pendente", "resolvida", "rejeitada", "todas"]);
const DIA_MS = 24 * 60 * 60 * 1000;

function isStaff(papel) {
  return STAFF_ROLES.has(papel);
}

function isSuspended(usuario, now = new Date()) {
  return Boolean(usuario?.suspensoAte && usuario.suspensoAte > now);
}

const userBrief = { select: { id: true, nome: true, foto: true, papel: true, suspensoAte: true } };

function presentReport(row) {
  return {
    id: row.id,
    motivo: row.motivo,
    status: row.status,
    acao: row.acao,
    criado_em: row.criadoEm,
    resolvido_em: row.resolvidoEm,
    denunciante: row.denunciante ? { id: row.denunciante.id, nome: row.denunciante.nome, foto: row.denunciante.foto } : null,
    denunciado: row.usuario
      ? {
          id: row.usuario.id,
          nome: row.usuario.nome,
          foto: row.usuario.foto,
          papel: row.usuario.papel,
          suspenso_ate: row.usuario.suspensoAte,
        }
      : null,
    post: row.post
      ? { id: row.post.id, conteudo: row.post.conteudo, imagem: row.post.imagem, tipo_arquivo: row.post.tipoArquivo, tema: row.post.tema }
      : null,
    post_removido: Boolean(!row.post && row.conteudoDenunciado !== null),
    conteudo_denunciado: row.conteudoDenunciado,
    resolvido_por: row.resolvidoPor ? { id: row.resolvidoPor.id, nome: row.resolvidoPor.nome } : null,
  };
}

async function listReports({ status = "pendente", limit = 50 } = {}) {
  const filtro = STATUS_FILTRO.has(status) ? status : "pendente";
  const take = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
  const rows = await prisma.denuncia.findMany({
    where: filtro === "todas" ? {} : { status: filtro },
    orderBy: [{ criadoEm: filtro === "pendente" ? "asc" : "desc" }, { id: "asc" }],
    take,
    select: {
      id: true, motivo: true, status: true, acao: true, criadoEm: true, resolvidoEm: true, conteudoDenunciado: true,
      denunciante: { select: { id: true, nome: true, foto: true } },
      usuario: userBrief,
      post: { select: { id: true, conteudo: true, imagem: true, tipoArquivo: true, tema: true } },
      resolvidoPor: { select: { id: true, nome: true } },
    },
  });
  return rows.map(presentReport);
}

// Registra a denúncia já apontando para o autor e guardando o texto do post,
// para o histórico sobreviver se o post for removido depois.
async function createReport({ denuncianteId, usuarioId, postId, motivo }) {
  let alvoUsuarioId = usuarioId || null;
  let conteudoDenunciado = null;
  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { usuarioId: true, conteudo: true } });
    if (!post) return { status: "post_not_found" };
    alvoUsuarioId = alvoUsuarioId || post.usuarioId;
    conteudoDenunciado = post.conteudo || "";
  }
  if (alvoUsuarioId === denuncianteId) return { status: "self" };
  if (alvoUsuarioId) {
    const alvo = await prisma.usuario.findUnique({ where: { id: alvoUsuarioId }, select: { id: true } });
    if (!alvo) return { status: "user_not_found" };
  }
  const denuncia = await prisma.denuncia.create({
    data: { denuncianteId, usuarioId: alvoUsuarioId, postId: postId || null, motivo, conteudoDenunciado },
    select: { id: true, status: true, criadoEm: true },
  });
  return { status: "ok", denuncia: { id: denuncia.id, status: denuncia.status, criado_em: denuncia.criadoEm } };
}

/**
 * Aplica a decisão do moderador.
 * Retorna { status, removedPostImage } — a imagem é apagada do armazenamento pelo chamador.
 */
async function resolveReport({ denunciaId, moderadorId, acao, dias, motivo }) {
  if (!ACOES.has(acao)) return { status: "invalid_action" };
  const denuncia = await prisma.denuncia.findUnique({
    where: { id: denunciaId },
    select: { id: true, status: true, postId: true, usuarioId: true, usuario: { select: { papel: true } } },
  });
  if (!denuncia) return { status: "not_found" };
  if (denuncia.status !== "pendente" && denuncia.status !== "em_analise") return { status: "already_resolved" };

  const now = new Date();
  const fechar = (where, status = "resolvida") =>
    prisma.denuncia.updateMany({ where: { ...where, status: { in: ["pendente", "em_analise"] } }, data: { status, acao, resolvidoPorId: moderadorId, resolvidoEm: now } });

  if (acao === "arquivar") {
    await fechar({ id: denuncia.id }, "rejeitada");
    return { status: "ok" };
  }

  if (acao === "remover_post") {
    if (!denuncia.postId) return { status: "no_post" };
    const post = await prisma.post.findUnique({ where: { id: denuncia.postId }, select: { id: true, imagem: true } });
    // Fecha todas as denúncias pendentes do mesmo post antes de removê-lo.
    await fechar({ postId: denuncia.postId });
    if (post) await prisma.post.delete({ where: { id: post.id } });
    return { status: "ok", removedPostImage: post?.imagem || null };
  }

  // suspender_usuario
  if (!denuncia.usuarioId) return { status: "no_user" };
  if (denuncia.usuarioId === moderadorId) return { status: "self" };
  if (isStaff(denuncia.usuario?.papel)) return { status: "target_is_staff" };
  const diasSuspensao = Math.min(Math.max(Number.parseInt(dias, 10) || 7, 1), 365);
  const suspensoAte = new Date(now.getTime() + diasSuspensao * DIA_MS);
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: denuncia.usuarioId },
      data: { suspensoAte, suspensoMotivo: String(motivo || "Violação das regras da comunidade.").slice(0, 300) },
    });
    await revokeAllUserSessions(denuncia.usuarioId, now, tx);
    await tx.denuncia.updateMany({
      where: { usuarioId: denuncia.usuarioId, status: { in: ["pendente", "em_analise"] } },
      data: { status: "resolvida", acao, resolvidoPorId: moderadorId, resolvidoEm: now },
    });
  });
  return { status: "ok", suspensoAte };
}

async function liftSuspension(usuarioId) {
  const updated = await prisma.usuario.updateMany({ where: { id: usuarioId }, data: { suspensoAte: null, suspensoMotivo: null } });
  return updated.count > 0;
}

async function metrics(now = new Date()) {
  const dias = (n) => new Date(now.getTime() - n * DIA_MS);
  const [
    usuarios, novos7d, ativos24h, ativos7d, posts7d, comentarios7d, curtidas7d, denunciasPendentes, suspensos,
    coorte, coorteAtiva, temas,
  ] = await prisma.$transaction([
    prisma.usuario.count(),
    prisma.usuario.count({ where: { criadoEm: { gte: dias(7) } } }),
    prisma.usuario.count({ where: { ultimoAcesso: { gte: dias(1) } } }),
    prisma.usuario.count({ where: { ultimoAcesso: { gte: dias(7) } } }),
    prisma.post.count({ where: { criadoEm: { gte: dias(7) } } }),
    prisma.comentario.count({ where: { criadoEm: { gte: dias(7) } } }),
    prisma.curtida.count({ where: { criadoEm: { gte: dias(7) } } }),
    prisma.denuncia.count({ where: { status: { in: ["pendente", "em_analise"] } } }),
    prisma.usuario.count({ where: { suspensoAte: { gt: now } } }),
    // Retenção: de quem se cadastrou entre 14 e 7 dias atrás, quantos voltaram nos últimos 7 dias.
    prisma.usuario.count({ where: { criadoEm: { gte: dias(14), lt: dias(7) } } }),
    prisma.usuario.count({ where: { criadoEm: { gte: dias(14), lt: dias(7) }, ultimoAcesso: { gte: dias(7) } } }),
    prisma.post.groupBy({
      by: ["tema"],
      where: { criadoEm: { gte: dias(30) } },
      _count: { _all: true },
      orderBy: { _count: { tema: "desc" } },
      take: 8,
    }),
  ]);
  return {
    gerado_em: now,
    usuarios: { total: usuarios, novos_7d: novos7d, ativos_24h: ativos24h, ativos_7d: ativos7d, suspensos },
    atividade_7d: { posts: posts7d, comentarios: comentarios7d, curtidas: curtidas7d },
    retencao_semana: { coorte, voltaram: coorteAtiva, percentual: coorte ? Math.round((coorteAtiva / coorte) * 100) : null },
    denuncias_pendentes: denunciasPendentes,
    temas_30d: temas.map((t) => ({ tema: t.tema || "Geral", posts: t._count._all })),
  };
}

module.exports = { createReport, isStaff, isSuspended, liftSuspension, listReports, metrics, resolveReport };
