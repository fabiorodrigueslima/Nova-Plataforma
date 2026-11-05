const prisma = require("../../lib/prisma");
const { blockedIdsFor, isBlockedEitherWay } = require("../social/block.service");

const LADOS = new Set(["a", "b"]);
const MAX_ARGUMENTO = 800;
const MAX_LADO = 60;
const MAX_PERGUNTA = 300;

function parseLado(value) {
  const lado = String(value || "").trim().toLowerCase();
  return LADOS.has(lado) ? lado : null;
}

function outroLado(lado) {
  return lado === "a" ? "b" : "a";
}

/** Valida os dados de um debate novo. Retorna { ok, erro, ladoA, ladoB }. */
function validateNewDebate({ pergunta, ladoA, ladoB }) {
  const a = String(ladoA || "").trim().slice(0, MAX_LADO) || "A favor";
  const b = String(ladoB || "").trim().slice(0, MAX_LADO) || "Contra";
  if (!String(pergunta || "").trim()) return { ok: false, erro: "Escreva a pergunta ou tese do debate." };
  if (String(pergunta).trim().length > MAX_PERGUNTA) return { ok: false, erro: `A pergunta do debate pode ter no máximo ${MAX_PERGUNTA} caracteres.` };
  if (a.toLocaleLowerCase("pt-BR") === b.toLocaleLowerCase("pt-BR")) return { ok: false, erro: "Os dois lados do debate precisam ter nomes diferentes." };
  return { ok: true, ladoA: a, ladoB: b };
}

/** Acrescenta contagem por lado, total de argumentos e a posição do leitor aos posts de debate. */
async function enrichDebates(items, viewerId) {
  const ids = items.filter((item) => item.tipo === "debate").map((item) => item.id);
  if (!ids.length) return items;
  const [porLado, minhas, argumentos] = await prisma.$transaction([
    prisma.debatePosicao.groupBy({ by: ["postId", "lado"], where: { postId: { in: ids } }, _count: { _all: true }, orderBy: { postId: "asc" } }),
    prisma.debatePosicao.findMany({ where: { postId: { in: ids }, usuarioId: viewerId }, select: { postId: true, lado: true } }),
    prisma.debateArgumento.groupBy({ by: ["postId"], where: { postId: { in: ids } }, _count: { _all: true }, orderBy: { postId: "asc" } }),
  ]);
  return items.map((item) => {
    if (item.tipo !== "debate") return item;
    const total = (lado) => porLado.find((row) => row.postId === item.id && row.lado === lado)?._count._all ?? 0;
    return {
      ...item,
      debate: {
        total_a: total("a"),
        total_b: total("b"),
        minha_posicao: minhas.find((row) => row.postId === item.id)?.lado ?? null,
        total_argumentos: argumentos.find((row) => row.postId === item.id)?._count._all ?? 0,
      },
    };
  });
}

async function findDebatePost(postId) {
  return prisma.post.findUnique({ where: { id: postId }, select: { id: true, tipo: true, usuarioId: true, ladoA: true, ladoB: true } });
}

/** Lista argumentos do debate, ranqueados: voto de quem está do outro lado vale o dobro. */
async function listArguments(postId, viewerId) {
  const bloqueados = await blockedIdsFor(viewerId);
  const rows = await prisma.debateArgumento.findMany({
    where: { postId, ...(bloqueados.length ? { usuarioId: { notIn: bloqueados } } : {}) },
    select: {
      id: true, usuarioId: true, lado: true, texto: true, criadoEm: true,
      usuario: { select: { id: true, nome: true, foto: true } },
      votos: { select: { usuarioId: true } },
      _count: { select: { mudancas: true } },
    },
  });
  const votantes = [...new Set(rows.flatMap((row) => row.votos.map((voto) => voto.usuarioId)))];
  const posicoes = votantes.length
    ? await prisma.debatePosicao.findMany({ where: { postId, usuarioId: { in: votantes } }, select: { usuarioId: true, lado: true } })
    : [];
  const ladoDe = new Map(posicoes.map((p) => [p.usuarioId, p.lado]));

  return rows
    .map((row) => {
      const votosOutroLado = row.votos.filter((voto) => ladoDe.get(voto.usuarioId) === outroLado(row.lado)).length;
      return {
        id: row.id,
        lado: row.lado,
        texto: row.texto,
        criado_em: row.criadoEm,
        autor: row.usuario,
        meu: row.usuarioId === viewerId,
        votos: row.votos.length,
        votos_outro_lado: votosOutroLado,
        pontuacao: row.votos.length + votosOutroLado,
        votei: row.votos.some((voto) => voto.usuarioId === viewerId),
        convenceu: row._count.mudancas,
      };
    })
    .sort((x, y) => y.pontuacao - x.pontuacao || new Date(x.criado_em) - new Date(y.criado_em));
}

async function choosePosition({ postId, usuarioId, lado, argumentoId, notify }) {
  const novoLado = parseLado(lado);
  if (!novoLado) return { status: "invalid_side" };
  const post = await findDebatePost(postId);
  if (!post || post.tipo !== "debate") return { status: "not_found" };

  const atual = await prisma.debatePosicao.findUnique({ where: { postId_usuarioId: { postId, usuarioId } }, select: { lado: true } });
  if (atual?.lado === novoLado) return { status: "ok", mudou: false };

  if (!atual) {
    await prisma.debatePosicao.create({ data: { postId, usuarioId, lado: novoLado } });
    return { status: "ok", mudou: false };
  }

  // Troca de lado: pode creditar o argumento (do novo lado, de outra pessoa) que convenceu.
  let argumento = null;
  if (argumentoId) {
    argumento = await prisma.debateArgumento.findUnique({ where: { id: argumentoId }, select: { id: true, postId: true, lado: true, usuarioId: true } });
    if (!argumento || argumento.postId !== postId || argumento.lado !== novoLado || argumento.usuarioId === usuarioId) {
      return { status: "invalid_argument" };
    }
  }
  await prisma.$transaction([
    prisma.debatePosicao.update({ where: { postId_usuarioId: { postId, usuarioId } }, data: { lado: novoLado, atualizadoEm: new Date() } }),
    prisma.mudancaOpiniao.create({ data: { postId, usuarioId, de: atual.lado, para: novoLado, argumentoId: argumento?.id ?? null } }),
  ]);
  if (argumento) {
    await notify({ destinatarioId: argumento.usuarioId, atorId: usuarioId, tipo: "convenceu", mensagem: "mudou de opinião por causa do seu argumento.", postId });
  }
  return { status: "ok", mudou: true };
}

async function createArgument({ postId, usuarioId, texto, notify }) {
  const post = await findDebatePost(postId);
  if (!post || post.tipo !== "debate") return { status: "not_found" };
  if (await isBlockedEitherWay(usuarioId, post.usuarioId)) return { status: "blocked" };
  const posicao = await prisma.debatePosicao.findUnique({ where: { postId_usuarioId: { postId, usuarioId } }, select: { lado: true } });
  if (!posicao) return { status: "no_position" };
  const conteudo = String(texto || "").trim();
  if (!conteudo) return { status: "empty" };
  if (conteudo.length > MAX_ARGUMENTO) return { status: "too_long" };

  const argumento = await prisma.debateArgumento.create({ data: { postId, usuarioId, lado: posicao.lado, texto: conteudo }, select: { id: true } });
  await notify({ destinatarioId: post.usuarioId, atorId: usuarioId, tipo: "argumento", mensagem: "argumentou no seu debate.", postId });
  return { status: "ok", id: argumento.id };
}

async function toggleVote({ argumentoId, usuarioId }) {
  const argumento = await prisma.debateArgumento.findUnique({ where: { id: argumentoId }, select: { usuarioId: true } });
  if (!argumento) return { status: "not_found" };
  if (argumento.usuarioId === usuarioId) return { status: "own" };
  if (await isBlockedEitherWay(usuarioId, argumento.usuarioId)) return { status: "blocked" };
  const key = { argumentoId_usuarioId: { argumentoId, usuarioId } };
  const existente = await prisma.argumentoVoto.findUnique({ where: key, select: { id: true } });
  if (existente) {
    await prisma.argumentoVoto.delete({ where: key });
    return { status: "ok", votei: false };
  }
  await prisma.argumentoVoto.create({ data: { argumentoId, usuarioId } });
  return { status: "ok", votei: true };
}

async function deleteArgument({ argumentoId, usuarioId, isStaff }) {
  const argumento = await prisma.debateArgumento.findUnique({ where: { id: argumentoId }, select: { usuarioId: true } });
  if (!argumento) return { status: "not_found" };
  if (argumento.usuarioId !== usuarioId && !isStaff) return { status: "forbidden" };
  await prisma.debateArgumento.delete({ where: { id: argumentoId } });
  return { status: "ok" };
}

/** Selos do perfil: quantas vezes mudou de ideia, quantas pessoas convenceu, votos recebidos. */
async function userStats(usuarioId) {
  const [mudancas, convencidos, votos] = await prisma.$transaction([
    prisma.mudancaOpiniao.count({ where: { usuarioId } }),
    prisma.mudancaOpiniao.count({ where: { argumento: { usuarioId } } }),
    prisma.argumentoVoto.count({ where: { argumento: { usuarioId } } }),
  ]);
  return { mudou_de_opiniao: mudancas, pessoas_convencidas: convencidos, votos_recebidos: votos };
}

module.exports = {
  MAX_ARGUMENTO,
  MAX_PERGUNTA,
  choosePosition,
  createArgument,
  deleteArgument,
  enrichDebates,
  listArguments,
  parseLado,
  toggleVote,
  userStats,
  validateNewDebate,
};
