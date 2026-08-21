function presentPost(post) {
  return {
    id: post.id,
    usuario_id: post.usuarioId,
    conteudo: post.conteudo,
    tema: post.tema,
    sentimento: post.sentimento,
    imagem: post.imagem,
    tipo_arquivo: post.tipoArquivo,
    nome_arquivo: post.nomeArquivo,
    criado_em: post.criadoEm,
    atualizado_em: post.atualizadoEm,
    nome: post.usuario?.nome,
    foto: post.usuario?.foto,
    total_curtidas: post._count?.curtidas ?? 0,
    total_comentarios: post._count?.comentarios ?? 0,
    total_compartilhamentos: post._count?.compartilhamentos ?? 0,
    curtiu: Boolean(post.curtidas?.length),
  };
}

module.exports = { presentPost };
