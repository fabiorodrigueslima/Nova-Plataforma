import api from "./api";

export async function loginComEmail(dados) {
  const res = await api.post("/login", dados);
  return res.data;
}

export async function cadastrarComEmail(formData) {
  const res = await api.post("/cadastro", formData);
  return res.data;
}

export async function loginComGoogle(credential) {
  const res = await api.post("/auth/google", { credential });
  return res.data;
}
