const FORBIDDEN_USER_FIELDS = [
  "senha",
  "google_id",
  "googleId",
  "provider",
  "token_recuperacao",
  "tokenRecuperacao",
  "token_expira",
  "tokenExpira",
];

function expectNoPrivateUserFields(value, { allowEmail = false } = {}) {
  const serialized = JSON.stringify(value);
  for (const field of FORBIDDEN_USER_FIELDS) {
    expect(serialized).not.toContain(`"${field}"`);
  }
  if (!allowEmail) expect(serialized).not.toContain('"email"');
}

module.exports = { FORBIDDEN_USER_FIELDS, expectNoPrivateUserFields };
