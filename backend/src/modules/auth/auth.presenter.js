function presentAuthenticatedUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    foto: user.foto,
    bio: user.bio,
    essencia_representa: user.essenciaRepresenta,
    essencia_tema: user.essenciaTema,
    essencia_frase: user.essenciaFrase,
    aberto_para: user.abertoPara,
  };
}

module.exports = { presentAuthenticatedUser };
