import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/style.css";

export default function Perfil() {
    const { id } = useParams();
    const navigate = useNavigate();

    const usuarioLogado = JSON.parse(localStorage.getItem("usuario") || "null");
    const token = localStorage.getItem("token");

    const perfilId = id || usuarioLogado?.id;
    const meuPerfil = Number(perfilId) === Number(usuarioLogado?.id);

    const [perfil, setPerfil] = useState(null);
    const [posts, setPosts] = useState([]);
    const [stats, setStats] = useState({
        total_posts: 0,
        total_seguidores: 0,
        total_seguindo: 0,
        seguindo: false,
    });

    const [loading, setLoading] = useState(true);
    const [abaAtiva, setAbaAtiva] = useState("posts");

    async function carregarPerfil() {
        try {
            setLoading(true);

            const [resUsuario, resStats, resPosts] = await Promise.all([
                api.get(`/usuarios/${perfilId}`),
                api.get(`/perfil/stats/${perfilId}`),
                api.get(`/usuarios/${perfilId}/posts`),
            ]);

            setPerfil(resUsuario.data);
            setStats(resStats.data);

            setPosts(
                Array.isArray(resPosts.data)
                    ? resPosts.data
                    : []
            );

        } catch (error) {

            console.error(
                "Erro ao carregar perfil:",
                error
            );

            setPerfil(null);

        } finally {

            setLoading(false);
        }
    }

    async function seguirUsuario() {
        try {

            const res = await api.post(
                `/seguir/${perfilId}`
            );

            const data = res.data;

            setStats((prev) => ({
                ...prev,
                seguindo: data.seguindo,
                total_seguidores: data.seguindo
                    ? Number(prev.total_seguidores) + 1
                    : Math.max(
                        Number(prev.total_seguidores) - 1,
                        0
                    ),
            }));

        } catch (error) {

            console.error(
                "Erro ao seguir:",
                error
            );

            alert(
                error.response?.data?.erro ||
                "Erro ao seguir usuário."
            );
        }
    }

    useEffect(() => {
        if (!token || !perfilId) {
            navigate("/login");
            return;
        }

        carregarPerfil();
    }, [perfilId, token]);

    if (loading) {
        return (
            <main className="perfil-page-pro">
                <div className="perfil-loading-pro">Carregando perfil...</div>
            </main>
        );
    }

    if (!perfil) {
        return (
            <main className="perfil-page-pro">
                <div className="perfil-loading-pro">Perfil não encontrado.</div>
            </main>
        );
    }

    return (
        <main className="perfil-page-pro">
            <section className="perfil-container-pro">
                <div className="perfil-cover-pro">
                    <div className="perfil-cover-glow"></div>
                </div>

                <div className="perfil-header-pro">
                    <div className="perfil-avatar-pro">
                        {perfil.foto ? (
                            <img src={perfil.foto} alt={perfil.nome} />
                        ) : (
                            <span>{perfil.nome?.charAt(0)}</span>
                        )}

                        <span className="perfil-online"></span>
                    </div>

                    <div className="perfil-info-pro">
                        <div className="perfil-top-pro">
                            <div>
                                <h1>
                                    {perfil.nome}
                                    <span className="perfil-badge">✓</span>
                                </h1>

                                <p className="perfil-email-pro">@{perfil.email}</p>
                            </div>

                            <div className="perfil-actions-pro">
                                <button
                                    onClick={() => navigate("/feed")}
                                    className="btn-voltar-pro"
                                >
                                    Voltar para o feed
                                </button>

                                {meuPerfil ? (
                                    <button
                                        onClick={() => navigate("/editar-perfil")}
                                        className="btn-editar-pro"
                                    >
                                        Editar perfil
                                    </button>
                                ) : (
                                    <button
                                        onClick={seguirUsuario}
                                        className={
                                            stats.seguindo
                                                ? "btn-seguindo-pro"
                                                : "btn-seguir-pro"
                                        }
                                    >
                                        {stats.seguindo ? "Seguindo" : "Seguir"}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="perfil-stats-pro">
                            <div>
                                <strong>{stats.total_posts || 0}</strong>
                                <span>Posts</span>
                            </div>

                            <div>
                                <strong>{stats.total_seguindo || 0}</strong>
                                <span>Seguindo</span>
                            </div>

                            <div>
                                <strong>{stats.total_seguidores || 0}</strong>
                                <span>Seguidores</span>
                            </div>
                        </div>

                        <p className="perfil-bio-pro">
                            {perfil.bio || "Este usuário ainda não adicionou uma bio."}
                        </p>
                    </div>
                </div>

                <section className="perfil-essencia-pro">
                    <div className="perfil-section-title">
                        <h2>Minha Essência</h2>
                        <p>Um pouco sobre este perfil</p>
                    </div>

                    <div className="essencia-grid-pro">
                        <div className="essencia-card-pro">
                            <span>💭</span>
                            <h3>O que me representa</h3>
                            <p>
                                {perfil.essencia_representa ||
                                    "Este usuário ainda não colocou o que representa ele."}
                            </p>
                        </div>

                        <div className="essencia-card-pro">
                            <span>🔥</span>
                            <h3>Meu tema favorito</h3>
                            <p>
                                {perfil.essencia_tema ||
                                    "Nenhum tema favorito informado."}
                            </p>
                        </div>

                        <div className="essencia-card-pro">
                            <span>🌟</span>
                            <h3>Minha frase</h3>
                            <p>
                                {perfil.essencia_frase ||
                                    "Nenhuma frase adicionada ainda."}
                            </p>
                        </div>

                        <div className="essencia-card-pro">
                            <span>🤝</span>
                            <h3>Estou aberto para</h3>
                            <p>{perfil.aberto_para || "Ainda não informado."}</p>
                        </div>
                    </div>
                </section>

                <section className="perfil-posts-pro">
                    <div className="perfil-tabs-pro">
                        <button
                            className={abaAtiva === "posts" ? "active" : ""}
                            onClick={() => setAbaAtiva("posts")}
                        >
                            Publicações
                        </button>

                        <button
                            className={abaAtiva === "fotos" ? "active" : ""}
                            onClick={() => setAbaAtiva("fotos")}
                        >
                            Fotos
                        </button>

                        <button
                            className={abaAtiva === "sobre" ? "active" : ""}
                            onClick={() => setAbaAtiva("sobre")}
                        >
                            Sobre
                        </button>
                    </div>

                    {abaAtiva === "posts" && (
                        <>
                            {posts.length === 0 ? (
                                <div className="perfil-empty-pro">
                                    <span>📭</span>
                                    <h3>Nenhum post publicado ainda</h3>
                                    <p>
                                        Quando este usuário postar, as publicações aparecerão aqui.
                                    </p>
                                </div>
                            ) : (
                                <div className="perfil-posts-grid-pro">
                                    {posts.map((post) => (
                                        <article className="perfil-post-card-pro" key={post.id}>
                                            {post.imagem && (
                                                <img
                                                    src={post.imagem}
                                                    alt="Post"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = "none";
                                                    }}
                                                />
                                            )}

                                            <div className="perfil-post-content-pro">
                                                {post.tema && <span>{post.tema}</span>}

                                                <p>{post.conteudo}</p>

                                                <div className="perfil-post-footer-pro">
                                                    <small>❤️ {post.total_curtidas || 0}</small>
                                                    <small>💬 {post.total_comentarios || 0}</small>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {abaAtiva === "fotos" && (
                        <div className="perfil-empty-pro">
                            <span>🖼️</span>
                            <h3>Fotos do perfil</h3>
                            <p>Em breve as fotos publicadas aparecerão aqui.</p>
                        </div>
                    )}

                    {abaAtiva === "sobre" && (
                        <div className="perfil-empty-pro">
                            <span>ℹ️</span>
                            <h3>Sobre o usuário</h3>
                            <p>
                                {perfil.bio ||
                                    "Este usuário ainda não adicionou informações."}
                            </p>
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}