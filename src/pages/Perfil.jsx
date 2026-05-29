import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    FiAlertTriangle,
    FiHeart,
    FiMessageCircle,
    FiSend,
    FiShare2,
    FiX,
} from "react-icons/fi";
import api from "../services/api";
import { analisarConteudo } from "../utils/moderacao";
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
    const [comentarioAberto, setComentarioAberto] = useState(null);
    const [comentariosPost, setComentariosPost] = useState({});
    const [novoComentario, setNovoComentario] = useState({});
    const [mensagemAberta, setMensagemAberta] = useState(false);
    const [mensagemTexto, setMensagemTexto] = useState("");
    const [enviandoMensagem, setEnviandoMensagem] = useState(false);

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
            setPosts(Array.isArray(resPosts.data) ? resPosts.data : []);
        } catch (error) {
            console.error("Erro ao carregar perfil:", error);
            setPerfil(null);
        } finally {
            setLoading(false);
        }
    }

    function validarTexto(texto, mensagemPadrao) {
        if (!texto?.trim()) {
            alert(mensagemPadrao);
            return false;
        }

        const moderacao = analisarConteudo(texto);

        if (!moderacao.aprovado) {
            alert(moderacao.motivo);
            return false;
        }

        return true;
    }

    async function seguirUsuario() {
        try {
            const res = await api.post(`/seguir/${perfilId}`);
            const data = res.data;

            setStats((prev) => ({
                ...prev,
                seguindo: data.seguindo,
                total_seguidores: data.seguindo
                    ? Number(prev.total_seguidores) + 1
                    : Math.max(Number(prev.total_seguidores) - 1, 0),
            }));
        } catch (error) {
            console.error("Erro ao seguir:", error);
            alert(error.response?.data?.erro || "Erro ao seguir usuário.");
        }
    }

    async function curtirPost(idPost) {
        try {
            const res = await api.post("/curtir", { post_id: idPost });
            const data = res.data;

            setPosts((prev) =>
                prev.map((post) => {
                    if (post.id !== idPost) return post;

                    const totalAtual = Number(post.total_curtidas || 0);

                    return {
                        ...post,
                        curtiu: data.curtiu,
                        total_curtidas: data.curtiu
                            ? totalAtual + 1
                            : Math.max(totalAtual - 1, 0),
                    };
                }),
            );
        } catch (error) {
            console.error("Erro ao curtir post:", error);
            alert(error.response?.data?.erro || "Erro ao curtir post.");
        }
    }

    async function abrirComentarios(idPost) {
        if (comentarioAberto === idPost) {
            setComentarioAberto(null);
            return;
        }

        setComentarioAberto(idPost);

        try {
            const res = await api.get(`/comentarios?post_id=${idPost}`);
            setComentariosPost((prev) => ({
                ...prev,
                [idPost]: Array.isArray(res.data) ? res.data : [],
            }));
        } catch (error) {
            console.error("Erro ao carregar comentários:", error);
            alert(error.response?.data?.erro || "Erro ao carregar comentários.");
        }
    }

    async function comentar(idPost) {
        const textoComentario = novoComentario[idPost];
        if (!validarTexto(textoComentario, "Escreva um comentário.")) return;

        try {
            const res = await api.post("/comentarios", {
                post_id: idPost,
                conteudo: textoComentario.trim(),
            });
            const comentario = res.data.comentario || res.data;

            setComentariosPost((prev) => ({
                ...prev,
                [idPost]: [...(prev[idPost] || []), comentario],
            }));

            setPosts((prev) =>
                prev.map((post) =>
                    post.id === idPost
                        ? {
                            ...post,
                            total_comentarios: Number(post.total_comentarios || 0) + 1,
                        }
                        : post,
                ),
            );

            setNovoComentario((prev) => ({ ...prev, [idPost]: "" }));
        } catch (error) {
            console.error("Erro ao comentar:", error);
            alert(error.response?.data?.erro || "Erro ao comentar.");
        }
    }

    async function compartilhar(post) {
        try {
            await api.post("/compartilhar", { post_id: post.id });
        } catch (error) {
            console.error("Erro ao registrar compartilhamento:", error);
        }

        const textoPost = post.conteudo || post.texto || "";
        const autor = post.autor || post.nome || perfil?.nome || "Usuário";
        const textoCompartilhar = `${autor} postou no PostFan:\n\n${textoPost}`;

        if (navigator.share) {
            navigator.share({ title: "PostFan", text: textoCompartilhar });
        } else {
            navigator.clipboard.writeText(textoCompartilhar);
            alert("Texto do post copiado para compartilhar.");
        }
    }

    async function denunciarPost(post) {
        const motivo = window.prompt("Conte rapidamente o motivo da denúncia:");
        if (!motivo) return;
        if (!validarTexto(motivo, "Informe o motivo da denúncia.")) return;

        try {
            await api.post("/denuncias", {
                post_id: post.id,
                usuario_id: post.usuario_id || perfilId,
                motivo: motivo.trim(),
            });

            alert("Denúncia enviada para análise.");
        } catch (error) {
            console.error("Erro ao denunciar post:", error);
            alert(error.response?.data?.erro || "Erro ao enviar denúncia.");
        }
    }

    async function denunciarPerfil() {
        const motivo = window.prompt("Conte rapidamente o motivo da denúncia:");
        if (!motivo) return;
        if (!validarTexto(motivo, "Informe o motivo da denúncia.")) return;

        try {
            await api.post("/denuncias", {
                usuario_id: perfilId,
                motivo: motivo.trim(),
            });

            alert("Denúncia enviada para análise.");
        } catch (error) {
            console.error("Erro ao denunciar perfil:", error);
            alert(error.response?.data?.erro || "Erro ao enviar denúncia.");
        }
    }

    async function enviarMensagem() {
        if (!validarTexto(mensagemTexto, "Digite uma mensagem.")) return;

        try {
            setEnviandoMensagem(true);

            await api.post("/mensagens", {
                destinatario_id: perfilId,
                mensagem: mensagemTexto.trim(),
            });

            setMensagemTexto("");
            setMensagemAberta(false);
            alert("Mensagem enviada com sucesso!");
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            alert(error.response?.data?.erro || "Erro ao enviar mensagem.");
        } finally {
            setEnviandoMensagem(false);
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
                                <button onClick={() => navigate("/feed")} className="btn-voltar-pro">
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
                                    <>
                                        <button
                                            onClick={() => setMensagemAberta(true)}
                                            className="btn-mensagem-pro"
                                        >
                                            <FiSend aria-hidden="true" /> Mensagem
                                        </button>

                                        <button
                                            onClick={seguirUsuario}
                                            className={stats.seguindo ? "btn-seguindo-pro" : "btn-seguir-pro"}
                                        >
                                            {stats.seguindo ? "Seguindo" : "Seguir"}
                                        </button>

                                        <button onClick={denunciarPerfil} className="btn-denunciar-pro">
                                            <FiAlertTriangle aria-hidden="true" /> Denunciar
                                        </button>
                                    </>
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
                            <p>{perfil.essencia_tema || "Nenhum tema favorito informado."}</p>
                        </div>

                        <div className="essencia-card-pro">
                            <span>🌟</span>
                            <h3>Minha frase</h3>
                            <p>{perfil.essencia_frase || "Nenhuma frase adicionada ainda."}</p>
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
                                    {posts.map((post) => {
                                        const comentarios = comentariosPost[post.id] || [];

                                        return (
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
                                                    {post.tema && <span>#{post.tema}</span>}

                                                    <p>{post.conteudo}</p>
                                                </div>

                                                <div className="perfil-post-actions-pro">
                                                    <button
                                                        className={post.curtiu ? "liked" : ""}
                                                        onClick={() => curtirPost(post.id)}
                                                    >
                                                        <FiHeart aria-hidden="true" /> {post.total_curtidas || 0}
                                                    </button>

                                                    <button onClick={() => abrirComentarios(post.id)}>
                                                        <FiMessageCircle aria-hidden="true" />{" "}
                                                        {post.total_comentarios || 0}
                                                    </button>

                                                    <button onClick={() => compartilhar(post)}>
                                                        <FiShare2 aria-hidden="true" /> Compartilhar
                                                    </button>

                                                    <button
                                                        className="report"
                                                        onClick={() => denunciarPost(post)}
                                                    >
                                                        <FiAlertTriangle aria-hidden="true" /> Denunciar
                                                    </button>
                                                </div>

                                                {comentarioAberto === post.id && (
                                                    <div className="perfil-comments-pro">
                                                        {comentarios.length === 0 ? (
                                                            <p className="no-comments">Nenhum comentário ainda.</p>
                                                        ) : (
                                                            comentarios.map((comentario) => (
                                                                <div className="comment-item" key={comentario.id}>
                                                                    <strong>
                                                                        {comentario.autor ||
                                                                            comentario.nome ||
                                                                            "Usuário"}
                                                                    </strong>
                                                                    <p>{comentario.conteudo || comentario.texto}</p>
                                                                    <span>
                                                                        {comentario.criado_em
                                                                            ? new Date(
                                                                                comentario.criado_em,
                                                                            ).toLocaleString("pt-BR")
                                                                            : comentario.criadoEm || "Agora mesmo"}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        )}

                                                        <div className="comment-form">
                                                            <input
                                                                type="text"
                                                                placeholder="Escreva um comentário..."
                                                                value={novoComentario[post.id] || ""}
                                                                onChange={(e) =>
                                                                    setNovoComentario({
                                                                        ...novoComentario,
                                                                        [post.id]: e.target.value,
                                                                    })
                                                                }
                                                            />
                                                            <button onClick={() => comentar(post.id)}>
                                                                <FiSend aria-hidden="true" /> Enviar
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
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
                            <p>{perfil.bio || "Este usuário ainda não adicionou informações."}</p>
                        </div>
                    )}
                </section>
            </section>

            {mensagemAberta && (
                <div className="perfil-message-overlay" role="dialog" aria-modal="true">
                    <div className="perfil-message-modal">
                        <button
                            className="perfil-message-close"
                            onClick={() => setMensagemAberta(false)}
                            aria-label="Fechar"
                        >
                            <FiX aria-hidden="true" />
                        </button>

                        <h2>Enviar mensagem</h2>
                        <p>Mensagem para {perfil.nome}</p>

                        <textarea
                            value={mensagemTexto}
                            onChange={(e) => setMensagemTexto(e.target.value)}
                            placeholder="Digite sua mensagem..."
                        />

                        <button onClick={enviarMensagem} disabled={enviandoMensagem}>
                            <FiSend aria-hidden="true" />
                            {enviandoMensagem ? "Enviando..." : "Enviar mensagem"}
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
