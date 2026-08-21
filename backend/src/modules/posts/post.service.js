const prisma = require("../../lib/prisma");
const { postFeedSelect } = require("./post.select");
const { presentPost } = require("./post.presenter");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function encodeCursor(post) {
  return Buffer.from(JSON.stringify({ criadoEm: post.criadoEm.toISOString(), id: post.id })).toString("base64url");
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const criadoEm = new Date(cursor.criadoEm);
    if (!Number.isInteger(cursor.id) || Number.isNaN(criadoEm.getTime())) return null;
    return { criadoEm, id: cursor.id };
  } catch { return null; }
}

async function listPosts({ viewerId, userId, limit, cursor }) {
  const take = parseLimit(limit);
  const decoded = decodeCursor(cursor);
  if (cursor && !decoded) return { status: "invalid_cursor" };
  const where = {
    ...(userId ? { usuarioId: userId } : {}),
    ...(decoded ? { OR: [{ criadoEm: { lt: decoded.criadoEm } }, { criadoEm: decoded.criadoEm, id: { lt: decoded.id } }] } : {}),
  };
  const rows = await prisma.post.findMany({
    where, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: take + 1,
    select: postFeedSelect(viewerId),
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { status: "ok", items: page.map(presentPost), nextCursor: hasMore ? encodeCursor(page.at(-1)) : null };
}

async function createPost(data, viewerId) {
  const post = await prisma.post.create({ data, select: postFeedSelect(viewerId) });
  return presentPost(post);
}

async function getPost(id, viewerId) {
  const post = await prisma.post.findUnique({ where: { id }, select: postFeedSelect(viewerId) });
  return post ? presentPost(post) : null;
}

async function findOwned(id, usuarioId) {
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true, usuarioId: true, conteudo: true, tema: true, sentimento: true, imagem: true } });
  if (!post) return { status: "not_found" };
  if (post.usuarioId !== usuarioId) return { status: "forbidden", post };
  return { status: "ok", post };
}

async function updatePost(id, data, viewerId) {
  const post = await prisma.post.update({ where: { id }, data: { ...data, atualizadoEm: new Date() }, select: postFeedSelect(viewerId) });
  return presentPost(post);
}

async function deletePost(id) { return prisma.post.delete({ where: { id }, select: { id: true } }); }
async function postExists(id) { return Boolean(await prisma.post.findUnique({ where: { id }, select: { id: true } })); }

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, createPost, decodeCursor, deletePost, findOwned, getPost, listPosts, parseLimit, postExists, updatePost };
