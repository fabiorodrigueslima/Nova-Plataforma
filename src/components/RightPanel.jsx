import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/style.css";

function Avatar({ className, foto, nome, onClick }) {
  const [erroImagem, setErroImagem] = useState(false);
  const inicial = nome?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <button
      type="button"
      className={`${className} ${onClick ? "avatar-clickable" : ""}`}
      onClick={onClick}
      aria-label={onClick ? `Abrir perfil de ${nome || "usuário"}` : undefined}
    >
      {foto && !erroImagem ? (
        <img
          src={foto}
          alt={nome || "Usuário"}
          onError={() => setErroImagem(true)}
        />
      ) : (
        <span>{inicial}</span>
      )}
    </button>
  );
}

export default function RightPanel({ posts = [] }) {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(
    () => JSON.parse(localStorage.getItem("usuario")) || {}
  );

  const token = localStorage.getItem("token");

  const [usuariosReais, setUsuariosReais] = useState([]);
  const [stats, setStats] = useState({
    total_posts: 0,
    total_seguindo: 0,
    total_seguidores: 0,
  });

  async function carregarUsuarioLogado() {

    try {

      if (!token) return;

      const res = await api.get("/me");

      const data = res.data;

      setUsuario(data);

      localStorage.setItem(
        "usuario",
        JSON.stringify(data)
      );

    } catch (error) {

      console.error(
        "Erro ao buscar usuário logado:",
        error
      );
    }
  }
  async function carregarSugestoes() {

    try {

      if (!token) return;

      const res = await api.get("/usuarios/sugestoes");

      const data = res.data;

      setUsuariosReais(
        Array.isArray(data) ? data : []
      );

    } catch (error) {

      console.error(
        "Erro ao buscar sugestões:",
        error
      );
    }
  }

  async function carregarStats(idUsuario = usuario?.id) {

    if (!idUsuario || !token) return;

    try {

      const res = await api.get(
        `/perfil/stats/${idUsuario}`
      );

      const data = res.data;

      setStats({
        total_posts: Number(data.total_posts) || 0,
        total_seguindo: Number(data.total_seguindo) || 0,
        total_seguidores: Number(data.total_seguidores) || 0,
      });

    } catch (error) {

      console.error(
        "Erro ao buscar estatísticas:",
        error
      );
    }
  }
  async function seguirUsuario(id) {

    try {

      const res = await api.post(`/seguir/${id}`);

      const data = res.data;

      setUsuariosReais((prev) =>
        prev.map((user) =>
          Number(user.id) === Number(id)
            ? {
              ...user,
              seguindo: data.seguindo
            }
            : user
        )
      );

      carregarStats(usuario?.id);

    } catch (error) {

      console.error("Erro ao seguir:", error);

      alert(
        error.response?.data?.erro ||
        "Erro ao seguir usuário."
      );
    }
  }

  useEffect(() => {
    async function iniciar() {
      await carregarUsuarioLogado();
      await carregarSugestoes();
    }

    iniciar();
  }, []);

  useEffect(() => {
    if (usuario?.id) {
      carregarStats(usuario.id);
    }
  }, [usuario?.id, posts.length]);

  useEffect(() => {
    function atualizarAoVoltar() {
      carregarUsuarioLogado();
      carregarSugestoes();

      if (usuario?.id) {
        carregarStats(usuario.id);
      }
    }

    window.addEventListener("focus", atualizarAoVoltar);

    return () => {
      window.removeEventListener("focus", atualizarAoVoltar);
    };
  }, [usuario?.id]);

  return (
    <aside className="right-panel">
      <div className="profile-card">
        <div className="profile-cover"></div>

        <Avatar
          className="profile-avatar"
          foto={usuario?.foto}
          nome={usuario?.nome}
          onClick={() => usuario?.id && navigate(`/perfil/${usuario.id}`)}
        />

        <h3>{usuario?.nome || "Usuário PostFan"}</h3>
        <p>@{usuario?.email || "usuario"}</p>

        <div className="profile-stats">
          <div>
            <strong>{stats.total_posts}</strong>
            <span>Posts</span>
          </div>

          <div>
            <strong>{stats.total_seguindo}</strong>
            <span>Seguindo</span>
          </div>

          <div>
            <strong>{stats.total_seguidores}</strong>
            <span>Seguidores</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-ver-perfil"
          onClick={() => navigate(`/perfil/${usuario?.id}`)}
        >
          Ver meu perfil
        </button>
      </div>

      <div className="right-card">
        <h4>🔵 QUEM SEGUIR</h4>

        {usuariosReais.length === 0 ? (
          <p>Nenhum usuário cadastrado para seguir ainda.</p>
        ) : (
          usuariosReais.slice(0, 4).map((user) => (
            <div className="suggestion-user" key={user.id}>
              <Avatar
                className="suggestion-avatar"
                foto={user?.foto}
                nome={user?.nome}
                onClick={() => navigate(`/perfil/${user.id}`)}
              />

              <div className="suggestion-info">
                <strong>{user.nome}</strong>
                <span>@{user.email}</span>
              </div>

              <button
                className={user.seguindo ? "following-btn" : ""}
                onClick={() => seguirUsuario(user.id)}
              >
                {user.seguindo ? "Seguindo" : "+ Seguir"}
              </button>
            </div>
          ))
        )}

        <button
          className="ver-mais-sugestoes"
          onClick={() => navigate("/sugestoes")}
        >
          Ver mais sugestões
        </button>
      </div>

      <footer className="right-footer">
        Copyright 2026 PostFan · Termos · Privacidade
      </footer>
    </aside>
  );
}
