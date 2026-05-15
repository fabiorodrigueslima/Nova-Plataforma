import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/style.css";

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

      const res = await fetch("http://localhost:5000/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setUsuario(data);
        localStorage.setItem("usuario", JSON.stringify(data));
      }
    } catch (error) {
      console.error("Erro ao buscar usuário logado:", error);
    }
  }

  async function carregarSugestoes() {
    try {
      if (!token) return;

      const res = await fetch("http://localhost:5000/usuarios/sugestoes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setUsuariosReais(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar sugestões:", error);
    }
  }

  async function carregarStats(idUsuario = usuario?.id) {
    if (!idUsuario || !token) return;

    try {
      const res = await fetch(
        `http://localhost:5000/perfil/stats/${idUsuario}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (res.ok) {
        setStats({
          total_posts: Number(data.total_posts) || 0,
          total_seguindo: Number(data.total_seguindo) || 0,
          total_seguidores: Number(data.total_seguidores) || 0,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    }
  }

  async function seguirUsuario(id) {
    try {
      const res = await fetch(`http://localhost:5000/seguir/${id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.erro || "Erro ao seguir usuário.");
        return;
      }

      setUsuariosReais((prev) =>
        prev.map((user) =>
          Number(user.id) === Number(id)
            ? { ...user, seguindo: data.seguindo }
            : user
        )
      );

      carregarStats(usuario?.id);
    } catch (error) {
      console.error("Erro ao seguir:", error);
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

        <div className="profile-avatar">
          {usuario?.foto ? (
            <img src={usuario.foto} alt={usuario.nome} />
          ) : (
            usuario?.nome?.charAt(0) || "?"
          )}
        </div>

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
              <div className="suggestion-avatar">
                {user?.foto ? (
                  <img src={user.foto} alt={user.nome} />
                ) : (
                  user?.nome?.charAt(0) || "?"
                )}
              </div>

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