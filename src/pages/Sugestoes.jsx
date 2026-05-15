import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/style.css";

export default function Sugestoes() {
    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);

    async function carregarSugestoes() {
        try {
            const res = await fetch("http://localhost:5000/usuarios/sugestoes", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await res.json();
            setUsuarios(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao buscar sugestões:", error);
        } finally {
            setLoading(false);
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

            setUsuarios((prev) =>
                prev.map((user) =>
                    user.id === id ? { ...user, seguindo: data.seguindo } : user
                )
            );
        } catch (error) {
            console.error("Erro ao seguir:", error);
        }
    }

    useEffect(() => {
        carregarSugestoes();
    }, []);

    return (
        <main className="sugestoes-page">
            <section className="sugestoes-container">
                <button className="sugestoes-voltar" onClick={() => navigate("/feed")}>
                    ← Voltar para o feed
                </button>

                <div className="sugestoes-header">
                    <h1>Quem seguir</h1>
                    <p>Conheça pessoas cadastradas no Postfan e comece novas conexões.</p>
                </div>

                {loading ? (
                    <p className="sugestoes-vazio">Carregando sugestões...</p>
                ) : usuarios.length === 0 ? (
                    <p className="sugestoes-vazio">
                        Nenhum usuário cadastrado para seguir ainda.
                    </p>
                ) : (
                    <div className="sugestoes-grid">
                        {usuarios.map((user) => (
                            <article className="sugestao-card" key={user.id}>
                                <div className="sugestao-avatar">
                                    {user.foto ? (
                                        <img src={user.foto} alt={user.nome} />
                                    ) : (
                                        <span>{user.nome?.charAt(0)}</span>
                                    )}
                                </div>

                                <h3>{user.nome}</h3>
                                <p>@{user.email}</p>

                                <small>
                                    {user.bio || "Este usuário ainda não adicionou uma bio."}
                                </small>

                                <div className="sugestao-actions">
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