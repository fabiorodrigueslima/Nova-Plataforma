import { useEffect, useMemo, useState } from "react";
import { FiRadio, FiUserCheck, FiUserPlus, FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/style.css";

function Avatar({ className, foto, nome, onClick, online = false }) {
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
        <img src={foto} alt={nome || "Usuário"} onError={() => setErroImagem(true)} />
      ) : (
        <span>{inicial}</span>
      )}

      {online && <span className="online-dot" aria-label="Online" />}
    </button>
  );
}

export default function RightPanel({ posts = [] }) {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [usuario, setUsuario] = useState(() => JSON.parse(localStorage.getItem("usuario") || "{}"));
  const [usuariosReais, setUsuariosReais] = useState([]);
  const [usuariosOnline, setUsuariosOnline] = useState([]);
  const [seguidores, setSeguidores] = useState([]);
  const [seguindo, setSeguindo] = useState([]);
  const [abaRede, setAbaRede] = useState("seguidores");
  const [stats, setStats] = useState({
    total_posts: 0,
    total_seguindo: 0,
    total_seguidores: 0,
  });

  async function carregarUsuarioLogado() {
    try {
      if (!token) return;

      const res = await api.get("/me");
      setUsuario(res.data);
      localStorage.setItem("usuario", JSON.stringify(res.data));
    } catch (error) {
      console.error("Erro ao buscar usuário logado:", error);
    }
  }

  async function carregarSugestoes() {
    try {
      if (!token) return;
      const res = await api.get("/usuarios/sugestoes");
      setUsuariosReais(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Erro ao buscar sugestões:", error);
    }
  }

  async function carregarOnline() {
    try {
      if (!token) return;
      const res = await api.get("/usuarios/online");
      setUsuariosOnline(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Erro ao buscar usuários online:", error);
    }
  }

  async function carregarRede() {
    try {
      if (!token) return;

      const [seguidoresRes, seguindoRes] = await Promise.all([
        api.get("/usuarios/seguidores"),
        api.get("/usuarios/seguindo"),
      ]);

      setSeguidores(Array.isArray(seguidoresRes.data) ? seguidoresRes.data : []);
      setSeguindo(Array.isArray(seguindoRes.data) ? seguindoRes.data : []);
    } catch (error) {
      console.error("Erro ao buscar rede:", error);
    }
  }

  async function carregarStats(idUsuario = usuario?.id) {
    if (!idUsuario || !token) return;

    try {
      const res = await api.get(`/perfil/stats/${idUsuario}`);
      const data = res.data;

      setStats({
        total_posts: Number(data.total_posts) || 0,
        total_seguindo: Number(data.total_seguindo) || 0,
        total_seguidores: Number(data.total_seguidores) || 0,
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    }
  }

  function atualizarUsuarioEmListas(id, seguindoAgora) {
    const atualizar = (lista) =>
      lista.map((user) =>
        Number(user.id) === Number(id) ? { ...user, seguindo: seguindoAgora } : user,
      );

    setUsuariosReais(atualizar);
    setUsuariosOnline(atualizar);
    setSeguidores(atualizar);
    setSeguindo((prev) => {
      if (seguindoAgora) return atualizar(prev);
      return prev.filter((user) => Number(user.id) !== Number(id));
    });
  }

  async function seguirUsuario(id) {
    try {
      const res = await api.post(`/seguir/${id}`);
      atualizarUsuarioEmListas(id, res.data.seguindo);
      await Promise.all([carregarStats(usuario?.id), carregarRede(), carregarSugestoes(), carregarOnline()]);
    } catch (error) {
      console.error("Erro ao seguir:", error);
      alert(error.response?.data?.erro || "Erro ao seguir usuário.");
    }
  }

  useEffect(() => {
    async function iniciar() {
      await Promise.all([carregarUsuarioLogado(), carregarSugestoes(), carregarOnline(), carregarRede()]);
    }

    iniciar();
  }, []);

  useEffect(() => {
    if (usuario?.id) carregarStats(usuario.id);
  }, [usuario?.id, posts.length]);

  useEffect(() => {
    function atualizarAoVoltar() {
      carregarUsuarioLogado();
      carregarSugestoes();
      carregarOnline();
      carregarRede();

      if (usuario?.id) carregarStats(usuario.id);
    }

    window.addEventListener("focus", atualizarAoVoltar);
    return () => window.removeEventListener("focus", atualizarAoVoltar);
  }, [usuario?.id]);

  const listaRede = useMemo(() => {
    if (abaRede === "seguindo") return seguindo;
    if (abaRede === "sugestoes") return usuariosReais;
    return seguidores;
  }, [abaRede, seguidores, seguindo, usuariosReais]);

  function renderUsuario(user, compacto = false) {
    return (
      <div className={`suggestion-user ${compacto ? "compact" : ""}`} key={user.id}>
        <Avatar
          className="suggestion-avatar"
          foto={user?.foto}
          nome={user?.nome}
          online={Boolean(user?.online)}
          onClick={() => navigate(`/perfil/${user.id}`)}
        />

        <div className="suggestion-info">
          <strong>{user.nome}</strong>
          <span>{user.online ? "Online agora" : `@${user.email}`}</span>
        </div>

        <button
          className={user.seguindo ? "following-btn" : ""}
          onClick={() => seguirUsuario(user.id)}
        >
          {user.seguindo ? <FiUserCheck aria-hidden="true" /> : <FiUserPlus aria-hidden="true" />}
          {compacto ? "" : user.seguindo ? "Seguindo" : "Seguir"}
        </button>
      </div>
    );
  }

  return (
    <aside className="right-panel">
      <div className="profile-card">
        <div className="profile-cover" />

        <Avatar
          className="profile-avatar"
          foto={usuario?.foto}
          nome={usuario?.nome}
          online
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

      <div className="right-card online-card">
        <div className="right-card-title">
          <FiRadio aria-hidden="true" />
          <h4>Online agora</h4>
        </div>

        {usuariosOnline.length === 0 ? (
          <p>Ninguém online neste momento.</p>
        ) : (
          usuariosOnline.slice(0, 5).map((user) => renderUsuario(user, true))
        )}
      </div>

      <div className="right-card network-card">
        <div className="right-card-title">
          <FiUsers aria-hidden="true" />
          <h4>Minha rede</h4>
        </div>

        <div className="network-tabs">
          <button className={abaRede === "seguidores" ? "active" : ""} onClick={() => setAbaRede("seguidores")}>
            Seguidores
          </button>
          <button className={abaRede === "seguindo" ? "active" : ""} onClick={() => setAbaRede("seguindo")}>
            Seguindo
          </button>
          <button className={abaRede === "sugestoes" ? "active" : ""} onClick={() => setAbaRede("sugestoes")}>
            Sugestões
          </button>
        </div>

        {listaRede.length === 0 ? (
          <p>
            {abaRede === "seguidores"
              ? "Você ainda não tem seguidores."
              : abaRede === "seguindo"
                ? "Você ainda não segue ninguém."
                : "Nenhuma sugestão disponível."}
          </p>
        ) : (
          listaRede.slice(0, 5).map((user) => renderUsuario(user))
        )}

        <button className="ver-mais-sugestoes" onClick={() => navigate("/sugestoes")}>
          Ver mais pessoas
        </button>
      </div>

      <footer className="right-footer">Copyright 2026 PostFan · Termos · Privacidade</footer>
    </aside>
  );
}
