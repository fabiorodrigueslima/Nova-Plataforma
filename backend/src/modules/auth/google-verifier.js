const { OAuth2Client } = require("google-auth-library");

function isValidGoogleClientId(clientId) {
  return /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(
    clientId || "",
  );
}

const googleVerifier = {
  isConfigured(clientId) {
    return Boolean(clientId);
  },
  isValidConfiguration(clientId) {
    return isValidGoogleClientId(clientId);
  },
  async verify(credential, clientId) {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    return ticket.getPayload();
  },
};

module.exports = googleVerifier;
