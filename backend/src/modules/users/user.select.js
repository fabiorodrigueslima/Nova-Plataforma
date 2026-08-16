const publicUserSelect = Object.freeze({
  id: true,
  nome: true,
  foto: true,
  bio: true,
  criadoEm: true,
  essenciaRepresenta: true,
  essenciaTema: true,
  essenciaFrase: true,
  abertoPara: true,
});

const privateUserSelect = Object.freeze({
  ...publicUserSelect,
  email: true,
});

const userCardFields = Object.freeze({
  id: true,
  nome: true,
  foto: true,
  bio: true,
  ultimoAcesso: true,
});

module.exports = { privateUserSelect, publicUserSelect, userCardFields };
