const GOOGLE_CLIENT_ID_PATTERN =
  /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/;

export function getGoogleClientId() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  if (!clientId || !GOOGLE_CLIENT_ID_PATTERN.test(clientId)) {
    return "";
  }

  return clientId;
}

export function getGoogleClientIdStatus() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    return {
      configured: false,
      message: "Configure o Google Client ID",
    };
  }

  if (!GOOGLE_CLIENT_ID_PATTERN.test(clientId)) {
    return {
      configured: false,
      message: "Google Client ID invalido",
    };
  }

  return {
    configured: true,
    message: "",
  };
}
