/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { setCsrfToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    api.get("/me", { skipAuthRedirect: true })
      .then(({ data }) => {
        setUsuario(data.usuario);
        setCsrfToken(data.csrfToken);
      })
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false));
  }, []);

  function salvarSessao(novoUsuario, novoCsrfToken) {
    setUsuario(novoUsuario || null);
    if (novoCsrfToken !== undefined) setCsrfToken(novoCsrfToken);
    setCarregando(false);
  }

  async function sair() {
    try { await api.post("/logout"); } catch { /* sessão já inválida */ }
    setCsrfToken(null);
    setUsuario(null);
  }

  const value = useMemo(() => ({
    autenticado: Boolean(usuario), carregando, salvarSessao, sair, usuario,
  }), [carregando, usuario]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
