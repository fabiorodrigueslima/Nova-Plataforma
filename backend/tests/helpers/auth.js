const jwt = require("jsonwebtoken");

function authHeader(user) {
  const token = jwt.sign(
    { id: user.id, nome: user.nome, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "5m" },
  );
  return { Authorization: `Bearer ${token}` };
}

module.exports = { authHeader };
