/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const usuarioSalvo = localStorage.getItem("usuario");

    try {
      return usuarioSalvo ? JSON.parse(usuarioSalvo) : null;
    } catch {
      localStorage.removeItem("usuario");
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem("token"));

  function salvarSessao(novoToken, novoUsuario) {
    if (novoToken) {
      localStorage.setItem("token", novoToken);
    }

    if (novoUsuario) {
      localStorage.setItem("usuario", JSON.stringify(novoUsuario));
    }

    setToken(novoToken || null);
    setUsuario(novoUsuario || null);
  }

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setToken(null);
    setUsuario(null);
  }

  const value = useMemo(
    () => ({
      autenticado: Boolean(token),
      salvarSessao,
      sair,
      token,
      usuario,
    }),
    [token, usuario],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return context;
}
