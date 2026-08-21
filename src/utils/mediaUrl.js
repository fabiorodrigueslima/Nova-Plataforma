import api from "../services/api";

export function resolverUrlMidia(url) {
  if (!url) return "";
  if (/^(blob:|data:)/i.test(url)) return url;

  const apiBase = api.defaults.baseURL || window.location.origin;

  try {
    const endereco = new URL(url, apiBase);
    const origemLocal = ["localhost", "127.0.0.1"].includes(endereco.hostname);
    const acessoExterno = !["localhost", "127.0.0.1"].includes(window.location.hostname);

    if (origemLocal && acessoExterno) endereco.hostname = window.location.hostname;
    return endereco.toString();
  } catch {
    return url;
  }
}
