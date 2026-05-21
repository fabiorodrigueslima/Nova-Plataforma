import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/style.css";

export default function Explorar() {
  const navigate = useNavigate();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  async function carregarUsuarios() {
    try {
      const res = await api.get("/usuarios/sugestoes");
      setUsuarios(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Erro ao carregar explorar:", error);
    } finally {
      setLoading(false);
    }
  }

  async function seguirUsuario(id) {
    try {
      const res = await api.post(`/seguir/${id}`);

      setUsuarios((prev) =>
        prev.map((user) =>
          Number(user.id) === Number(id)
            ? { ...user, seguindo: res.data.seguindo }
            : user
        )
      );
    } catch (error) {
      alert(error.response?.data?.erro || "Erro ao seguir usuário.");
    }
  }

  useEffect(() => {
    carregarUsuarios();
  }, []);

  return (
    <main className="explorar-page">
      <section className="explorar-container">
        <button
          className="explorar-voltar"
          onClick={() => navigate("/feed")}
        >
          ← Voltar para o feed
        </button>

        <div className="explorar-header">
          <h1>Explorar perfis</h1>
          <p>Encontre pessoas cadastradas no PostFan e descubra novas conexões.</p>
        </div>

        {loading ? (
          <p className="explorar-vazio">Carregando perfis...</p>
        ) : usuarios.length === 0 ? (
          <p className="explorar-vazio">Nenhum perfil encontrado.</p>
        ) : (
          <div className="explorar-grid">
            {usuarios.map((user) => (
              <article className="explorar-card" key={user.id}>
                <div className="explorar-avatar">
                  {user.foto ? (
                    <img src={user.foto} alt={user.nome} />
                  ) : (
                    <span>{user.nome?.charAt(0) || "?"}</span>
                  )}
                </div>

                <h3>{user.nome}</h3>
                <p>@{user.email}</p>

                <small>
                  {user.bio || "Este usuário ainda não adicionou uma bio."}
                </small>

                <div className="explorar-actions">
                  <button onClick={() => navigate(`/perfil/${user.id}`)}>
                    Ver perfil
                  </button>

                  <button
                    className={user.seguindo ? "seguindo" : ""}
                    onClick={() => seguirUsuario(user.id)}
                  >
                    {user.seguindo ? "Seguindo" : "Seguir"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}