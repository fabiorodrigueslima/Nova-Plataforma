const postAuthorSelect = Object.freeze({ id: true, nome: true, foto: true });

function postFeedSelect(viewerId) {
  return {
    id: true, usuarioId: true, conteudo: true, tema: true, sentimento: true,
    imagem: true, tipoArquivo: true, nomeArquivo: true, criadoEm: true, atualizadoEm: true,
    usuario: { select: postAuthorSelect },
    _count: { select: { curtidas: true, comentarios: true, compartilhamentos: true } },
    curtidas: { where: { usuarioId: viewerId }, select: { id: true }, take: 1 },
  };
}

module.exports = { postAuthorSelect, postFeedSelect };
