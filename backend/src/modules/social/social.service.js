const prisma = require("../../lib/prisma");

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function notify({ destinatarioId, atorId, tipo, mensagem, postId = null }) {
  if (destinatarioId === atorId) return;
  await prisma.notificacao.create({ data: { destinatarioId, atorId, tipo, mensagem, postId } });
}

async function toggleLike(usuarioId, postId) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { usuarioId: true } });
  if (!post) return { status: "not_found" };
  const key = { usuarioId_postId: { usuarioId, postId } };
  const existing = await prisma.curtida.findUnique({ where: key, select: { id: true } });
  if (existing) {
    await prisma.curtida.delete({ where: key });
    return { status: "ok", curtiu: false };
  }
  await prisma.curtida.create({ data: { usuarioId, postId } });
  await notify({ destinatarioId: post.usuarioId, atorId: usuarioId, tipo: "curtida", mensagem: "curtiu sua publicação.", postId });
  return { status: "ok", curtiu: true };
}

async function toggleFollow(seguidorId, seguindoId) {
  if (seguidorId === seguindoId) return { status: "self" };
  const target = await prisma.usuario.findUnique({ where: { id: seguindoId }, select: { id: true } });
  if (!target) return { status: "not_found" };
  const key = { seguidorId_seguindoId: { seguidorId, seguindoId } };
  const existing = await prisma.seguidor.findUnique({ where: key, select: { id: true } });
  if (existing) {
    await prisma.seguidor.delete({ where: key });
    return { status: "ok", seguindo: false };
  }
  await prisma.seguidor.create({ data: { seguidorId, seguindoId } });
  await notify({ destinatarioId: seguindoId, atorId: seguidorId, tipo: "seguidor", mensagem: "começou a seguir você." });
  return { status: "ok", seguindo: true };
}

async function share(usuarioId, postId) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { usuarioId: true } });
  if (!post) return { status: "not_found" };
  const key = { usuarioId_postId: { usuarioId, postId } };
  const existing = await prisma.compartilhamento.findUnique({ where: key, select: { id: true } });
  if (existing) return { status: "duplicate" };
  await prisma.compartilhamento.create({ data: { usuarioId, postId } });
  await notify({ destinatarioId: post.usuarioId, atorId: usuarioId, tipo: "compartilhamento", mensagem: "compartilhou sua publicação.", postId });
  return { status: "ok" };
}

async function createComment(usuarioId, postId, conteudo) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { usuarioId: true } });
  if (!post) return null;
  const comment = await prisma.comentario.create({
    data: { usuarioId, postId, conteudo, texto: conteudo },
    select: { id: true, usuarioId: true, postId: true, conteudo: true, criadoEm: true, usuario: { select: { nome: true, foto: true } } },
  });
  await notify({ destinatarioId: post.usuarioId, atorId: usuarioId, tipo: "comentario", mensagem: "comentou em sua publicação.", postId });
  return { id: comment.id, usuario_id: comment.usuarioId, post_id: comment.postId, conteudo: comment.conteudo, criado_em: comment.criadoEm, nome: comment.usuario.nome, foto: comment.usuario.foto };
}

function presentComment(comment) {
  return {
    id: comment.id,
    usuario_id: comment.usuarioId,
    post_id: comment.postId,
    conteudo: comment.conteudo || comment.texto,
    criado_em: comment.criadoEm,
    nome: comment.usuario?.nome,
    foto: comment.usuario?.foto,
  };
}

async function listComments(postId) {
  const rows = await prisma.comentario.findMany({
    where: { postId },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    take: 200,
    select: { id: true, usuarioId: true, postId: true, conteudo: true, texto: true, criadoEm: true, usuario: { select: { nome: true, foto: true } } },
  });
  return rows.map(presentComment);
}

async function updateComment(id, usuarioId, conteudo) {
  const current = await prisma.comentario.findUnique({ where: { id }, select: { usuarioId: true } });
  if (!current) return { status: "not_found" };
  if (current.usuarioId !== usuarioId) return { status: "forbidden" };
  const comment = await prisma.comentario.update({
    where: { id }, data: { conteudo, texto: conteudo },
    select: { id: true, usuarioId: true, postId: true, conteudo: true, texto: true, criadoEm: true, usuario: { select: { nome: true, foto: true } } },
  });
  return { status: "ok", comment: presentComment(comment) };
}

async function deleteComment(id, usuarioId) {
  const current = await prisma.comentario.findUnique({ where: { id }, select: { usuarioId: true, postId: true } });
  if (!current) return { status: "not_found" };
  if (current.usuarioId !== usuarioId) return { status: "forbidden" };
  await prisma.comentario.delete({ where: { id } });
  return { status: "ok", postId: current.postId };
}

async function listNotifications(destinatarioId, limit = 30) {
  const take = Math.min(Math.max(Number.parseInt(limit, 10) || 30, 1), 50);
  const [items, unread] = await prisma.$transaction([
    prisma.notificacao.findMany({ where: { destinatarioId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take, select: { id: true, tipo: true, mensagem: true, postId: true, lidaEm: true, criadoEm: true, ator: { select: { id: true, nome: true, foto: true } } } }),
    prisma.notificacao.count({ where: { destinatarioId, lidaEm: null } }),
  ]);
  return { items, unread };
}

module.exports = { createComment, deleteComment, listComments, listNotifications, parsePositiveId, share, toggleFollow, toggleLike, updateComment };
