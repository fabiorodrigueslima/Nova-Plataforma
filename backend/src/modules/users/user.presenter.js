function presentPublicUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    foto: user.foto,
    bio: user.bio,
    criado_em: user.criadoEm,
    essencia_representa: user.essenciaRepresenta,
    essencia_tema: user.essenciaTema,
    essencia_frase: user.essenciaFrase,
    aberto_para: user.abertoPara,
  };
}

function presentPrivateUser(user) {
  return { ...presentPublicUser(user), email: user.email };
}

function presentUserCard(user, following) {
  const lastAccess = user.ultimoAcesso;
  return {
    id: user.id,
    nome: user.nome,
    foto: user.foto,
    bio: user.bio,
    ultimo_acesso: lastAccess,
    online: Boolean(lastAccess && lastAccess > new Date(Date.now() - 5 * 60 * 1000)),
    seguindo: following,
  };
}

module.exports = { presentPrivateUser, presentPublicUser, presentUserCard };
