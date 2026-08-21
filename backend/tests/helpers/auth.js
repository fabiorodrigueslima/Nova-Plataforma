const sessionService = require("../../src/modules/auth/session.service");

async function authHeader(user) {
  const session = await sessionService.createSession(user.id, "postfan-test-agent");
  return {
    Cookie: `postfan_session=${session.token}`,
    "X-CSRF-Token": sessionService.csrfTokenFor(session.token, process.env.SESSION_SECRET),
  };
}

module.exports = { authHeader };
