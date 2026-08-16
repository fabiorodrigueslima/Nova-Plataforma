const { testPool } = require("../helpers/database");

let sequence = 0;

async function createTestUser(overrides = {}) {
  sequence += 1;
  const values = {
    nome: `Test User ${sequence}`,
    email: `user-${sequence}@test.local`,
    senha: "test-password-hash",
    foto: null,
    bio: null,
    googleId: null,
    ultimoAcesso: null,
    ...overrides,
  };
  const result = await testPool.query(
    `INSERT INTO usuarios
       (nome, email, senha, provider, foto, bio, google_id, ultimo_acesso)
     VALUES ($1, $2, $3, 'local', $4, $5, $6, $7) RETURNING *`,
    [
      values.nome,
      values.email,
      values.senha,
      values.foto,
      values.bio,
      values.googleId,
      values.ultimoAcesso,
    ],
  );
  return result.rows[0];
}

async function createTestFollow(followerId, followedId) {
  const result = await testPool.query(
    `INSERT INTO seguidores (seguidor_id, seguindo_id)
     VALUES ($1, $2) RETURNING *`,
    [followerId, followedId],
  );
  return result.rows[0];
}

module.exports = { createTestFollow, createTestUser };
