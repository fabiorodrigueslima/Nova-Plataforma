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
import { useNotification } from "../context/notificationStore";
import "../styles/style.css";

export default function Perfil() {
    const { id } = useParams();
    const navigate = useNavigate();
    const dialog = useNotification();

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
    const [comentarioEditando, setComentarioEditando] = useState(null);
    const [textoComentarioEditado, setTextoComentarioEditado] = useState("");
    const [mensagemAberta, setMensagemAberta] = useState(false);
    const [mensagemTexto, setMensagemTexto] = useState("");
    const [mensagensChat, setMensagensChat] = useState([]);
    const [enviandoMensagem, setEnviandoMensagem] = useState(false);
    const [postAberto, setPostAberto] = useState(null);

    const fotosDoPerfil = posts.filter((post) => isImagePost(post));
    const videosDoPerfil = posts.filter((post) => isVideoPost(post));

    function isImagePost(post) {
        const tipo = post.tipo_arquivo || "";
        const url = post.imagem || "";

        return Boolean(url) && (tipo.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(url));
    }

    function isVideoPost(post) {
        const tipo = post.tipo_arquivo || "";
        const url = post.imagem || "";

        return Boolean(url) && (tipo.startsWith("video/") || /\.(mp4|webm|mov|ogg)$/i.test(url));
    }

    function renderPostMedia(post, className = "perfil-post-media-pro") {
        if (!post.imagem) return null;

        if (isVideoPost(post)) {
            return (
                <video
                    className={className}
                    src={post.imagem}
                    controls
                    preload="metadata"
                    onClick={(e) => e.stopPropagation()}
                />
            );
        }

        if (isImagePost(post)) {
            return (
                <img
                    className={className}
                    src={post.imagem}
                    alt="Post"
                    onError={(e) => {
                        e.currentTarget.style.display = "none";
                    }}
                />
            );
        }

        return (
            <a
                className="perfil-document-link-pro"
                href={post.imagem}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
            >
                Abrir documento publicado
            </a>
        );
    }

    function renderMediaGrid(lista, tipo) {
        if (lista.length === 0) {
            return (
                <div className="perfil-empty-pro">
                    <span>{tipo === "fotos" ? "🖼️" : "🎬"}</span>
                    <h3>{tipo === "fotos" ? "Nenhuma foto publicada" : "Nenhum vídeo publicado"}</h3>
                    <p>
                        {tipo === "fotos"
                            ? "Quando este usuário publicar fotos, elas aparecerão aqui."
                            : "Quando este usuário publicar vídeos, eles aparecerão aqui."}
                    </p>
                </div>
            );
        }

        return (
            <div className="perfil-media-grid-pro">
                {lista.map((post) => (
                    <button
                        type="button"
                        className="perfil-media-item-pro"
                        key={post.id}
                        onClick={() => abrirPost(post)}
                    >
                        {renderPostMedia(post, "perfil-media-preview-pro")}
                        {post.conteudo && <span>{post.conteudo}</span>}
                    </button>
                ))}
            </div>
        );
    }

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
            dialog.notify({
                type: "warning",
                title: "Ação incompleta",
                message: mensagemPadrao,
            });
            return false;
        }

        const moderacao = analisarConteudo(texto);

        if (!moderacao.aprovado) {
            dialog.notify({
                type: "warning",
                title: "Conteúdo em revisão",
                message: moderacao.motivo,
            });
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
            dialog.notify({
                type: "danger",
                title: "Não foi possível seguir",
                message: error.response?.data?.erro || "Erro ao seguir usuário.",
            });
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
            dialog.notify({
                type: "danger",
                title: "Curtida não registrada",
                message: error.response?.data?.erro || "Erro ao curtir post.",
            });
        }
    }

    async function carregarComentarios(idPost) {
        try {
            const res = await api.get(`/comentarios?post_id=${idPost}`);
            setComentariosPost((prev) => ({
                ...prev,
                [idPost]: Array.isArray(res.data) ? res.data : [],
            }));
        } catch (error) {
            console.error("Erro ao carregar comentários:", error);
            dialog.notify({
                type: "danger",
                title: "Comentários indisponíveis",
                message: error.response?.data?.erro || "Erro ao carregar comentários.",
            });
        }
    }

    async function abrirComentarios(idPost) {
        if (comentarioAberto === idPost) {
            setComentarioAberto(null);
            return;
        }

        setComentarioAberto(idPost);
        carregarComentarios(idPost);
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

            setPostAberto((prev) =>
                prev?.id === idPost
                    ? {
                        ...prev,
                        total_comentarios: Number(prev.total_comentarios || 0) + 1,
                    }
                    : prev,
            );

            setNovoComentario((prev) => ({ ...prev, [idPost]: "" }));
        } catch (error) {
            console.error("Erro ao comentar:", error);
            dialog.notify({
                type: "danger",
                title: "Comentário não enviado",
                message: error.response?.data?.erro || "Erro ao comentar.",
            });
        }
    }

    function iniciarEdicaoComentario(comentario) {
        setComentarioEditando(comentario.id);
        setTextoComentarioEditado(comentario.conteudo || comentario.texto || "");
    }

    function cancelarEdicaoComentario() {
        setComentarioEditando(null);
        setTextoComentarioEditado("");
    }

    async function salvarComentario(idPost, comentarioId) {
        if (!validarTexto(textoComentarioEditado, "Digite o novo comentário.")) return;

        try {
            const res = await api.put(`/comentarios/${comentarioId}`, {
                conteudo: textoComentarioEditado.trim(),
            });

            const comentarioAtualizado = res.data.comentario || res.data;

            setComentariosPost((prev) => ({
                ...prev,
                [idPost]: (prev[idPost] || []).map((comentario) =>
                    comentario.id === comentarioId
                        ? {
                            ...comentario,
                            ...comentarioAtualizado,
                            conteudo: comentarioAtualizado.conteudo || textoComentarioEditado.trim(),
                        }
                        : comentario,
                ),
            }));

            cancelarEdicaoComentario();
        } catch (error) {
            console.error("Erro ao editar comentário:", error);
            dialog.notify({
                type: "danger",
                title: "Comentário não atualizado",
                message: error.response?.data?.erro || "Erro ao editar comentário.",
            });
        }
    }

    async function excluirComentario(idPost, comentarioId) {
        if (!comentarioId) {
            dialog.notify({
                type: "danger",
                title: "Comentário inválido",
                message: "Não foi possível identificar esse comentário para exclusão.",
            });
            return;
        }

        const confirmado = await dialog.confirm({
            type: "danger",
            title: "Excluir comentário",
            message: "Este comentário será removido da publicação. Essa ação não pode ser desfeita.",
            confirmText: "Excluir",
        });

        if (!confirmado) return;

        try {
            await api.delete(`/comentarios/${comentarioId}`);

            setComentariosPost((prev) => ({
                ...prev,
                [idPost]: (prev[idPost] || []).filter((comentario) => comentario.id !== comentarioId),
            }));

            setPosts((prev) =>
                prev.map((post) =>
                    post.id === idPost
                        ? {
                            ...post,
                            total_comentarios: Math.max(Number(post.total_comentarios || 0) - 1, 0),
                        }
                        : post,
                ),
            );

            setPostAberto((prev) =>
                prev?.id === idPost
                    ? {
                        ...prev,
                        total_comentarios: Math.max(Number(prev.total_comentarios || 0) - 1, 0),
                    }
                    : prev,
            );
        } catch (error) {
            console.error("Erro ao excluir comentário:", error);
            dialog.notify({
                type: "danger",
                title: "Comentário não excluído",
                message:
                    error.response?.data?.erro ||
                    "Não foi possível excluir o comentário agora. Tente novamente em instantes.",
            });
        }
    }

    function renderComentario(comentario, idPost, mostrarData = true) {
        const meuComentario = Number(comentario.usuario_id) === Number(usuarioLogado?.id);
        const emEdicao = comentarioEditando === comentario.id;

        return (
            <div className="comment-item perfil-comment-item-pro" key={comentario.id}>
                <div className="perfil-comment-header-pro">
                    <strong>{comentario.autor || comentario.nome || "Usuário"}</strong>

                    {meuComentario && (
                        <div className="perfil-comment-actions-pro">
                            <button type="button" onClick={() => iniciarEdicaoComentario(comentario)}>
                                Editar
                            </button>
                            <button type="button" onClick={() => excluirComentario(idPost, comentario.id)}>
                                Excluir
                            </button>
                        </div>
                    )}
                </div>

                {emEdicao ? (
                    <div className="perfil-comment-edit-pro">
                        <textarea
                            value={textoComentarioEditado}
                            onChange={(e) => setTextoComentarioEditado(e.target.value)}
                            autoFocus
                        />

                        <div>
                            <button type="button" onClick={() => salvarComentario(idPost, comentario.id)}>
                                Salvar
                            </button>
                            <button type="button" onClick={cancelarEdicaoComentario}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                ) : (
                    <p>{comentario.conteudo || comentario.texto}</p>
                )}

                {mostrarData && !emEdicao && (
                    <span>
                        {comentario.criado_em
                            ? new Date(comentario.criado_em).toLocaleString("pt-BR")
                            : comentario.criadoEm || "Agora mesmo"}
                    </span>
                )}
            </div>
        );
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
            dialog.notify({
                type: "success",
                title: "Link pronto para compartilhar",
                message: "O conteúdo da publicação foi copiado para a área de transferência.",
            });
        }
    }

    function abrirPost(post) {
        setPostAberto(post);
        setComentarioAberto(post.id);
        carregarComentarios(post.id);
    }

    async function denunciarPost(post) {
        const motivo = await dialog.prompt({
            type: "danger",
            title: "Denunciar publicação",
            message:
                "Descreva o motivo da denúncia. Sua análise ajuda a manter o PostFan mais seguro para todos.",
            placeholder: "Exemplo: conteúdo ofensivo, ameaça, spam ou informação falsa...",
            confirmText: "Enviar denúncia",
        });
        if (!motivo) return;
        if (!validarTexto(motivo, "Informe o motivo da denúncia.")) return;

        try {
            await api.post("/denuncias", {
                post_id: post.id,
                usuario_id: post.usuario_id || perfilId,
                motivo: motivo.trim(),
            });

            dialog.notify({
                type: "success",
                title: "Denúncia enviada",
                message: "Obrigado pelo cuidado. Nossa equipe vai analisar essa publicação.",
            });
        } catch (error) {
            console.error("Erro ao denunciar post:", error);
            dialog.notify({
                type: "danger",
                title: "Denúncia não enviada",
                message: error.response?.data?.erro || "Erro ao enviar denúncia.",
            });
        }
    }

    async function enviarMensagem() {
        if (!validarTexto(mensagemTexto, "Digite uma mensagem.")) return;

        try {
            setEnviandoMensagem(true);

            const res = await api.post("/mensagens", {
                destinatario_id: perfilId,
                mensagem: mensagemTexto.trim(),
            });

            const mensagemCriada = res.data.dados;

            if (mensagemCriada) {
                setMensagensChat((prev) => [...prev, mensagemCriada]);
            }

            setMensagemTexto("");
            carregarMensagens();
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            dialog.notify({
                type: "danger",
                title: "Mensagem não enviada",
                message: error.response?.data?.erro || "Erro ao enviar mensagem.",
            });
        } finally {
            setEnviandoMensagem(false);
        }
    }

    async function carregarMensagens() {
        if (meuPerfil) return;

        try {
            const res = await api.get(`/mensagens/${perfilId}`);
            setMensagensChat(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Erro ao carregar mensagens:", error);
        }
    }

    useEffect(() => {
        if (!token || !perfilId) {
            navigate("/login");
            return;
        }

        carregarPerfil();
    }, [perfilId, token]);

    useEffect(() => {
        if (!mensagemAberta || meuPerfil) return undefined;

        carregarMensagens();
        const intervalo = window.setInterval(carregarMensagens, 3000);

        return () => window.clearInterval(intervalo);
    }, [mensagemAberta, perfilId, meuPerfil]);

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
                            className={abaAtiva === "videos" ? "active" : ""}
                            onClick={() => setAbaAtiva("videos")}
                        >
                            Vídeos
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
                                            <article
                                                className="perfil-post-card-pro"
                                                key={post.id}
                                                onClick={() => abrirPost(post)}
                                            >
                                                {renderPostMedia(post)}

                                                <div className="perfil-post-content-pro">
                                                    {post.tema && <span>#{post.tema}</span>}

                                                    <p>{post.conteudo}</p>
                                                </div>

                                                <div className="perfil-post-actions-pro">
                                                    <button
                                                        className={post.curtiu ? "liked" : ""}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            curtirPost(post.id);
                                                        }}
                                                    >
                                                        <FiHeart aria-hidden="true" /> {post.total_curtidas || 0}
                                                    </button>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            abrirPost(post);
                                                        }}
                                                    >
                                                        <FiMessageCircle aria-hidden="true" />{" "}
                                                        {post.total_comentarios || 0}
                                                    </button>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            compartilhar(post);
                                                        }}
                                                    >
                                                        <FiShare2 aria-hidden="true" /> Compartilhar
                                                    </button>
                                                </div>

                                                {comentarioAberto === post.id && (
                                                    <div className="perfil-comments-pro">
                                                        {comentarios.length === 0 ? (
                                                            <p className="no-comments">Nenhum comentário ainda.</p>
                                                        ) : (
                                                            comentarios.map((comentario) => (
                                                                renderComentario(comentario, post.id)
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

                    {abaAtiva === "fotos" && renderMediaGrid(fotosDoPerfil, "fotos")}

                    {abaAtiva === "videos" && renderMediaGrid(videosDoPerfil, "videos")}

                    {abaAtiva === "sobre" && (
                        <div className="perfil-about-pro">
                            <div>
                                <h3>Sobre {perfil.nome}</h3>
                                <p>{perfil.bio || "Este usuário ainda não adicionou uma bio."}</p>
                            </div>

                            <div className="perfil-about-grid-pro">
                                <section>
                                    <strong>O que me representa</strong>
                                    <p>
                                        {perfil.essencia_representa ||
                                            "Ainda não informou o que representa seu perfil."}
                                    </p>
                                </section>

                                <section>
                                    <strong>Tema favorito</strong>
                                    <p>{perfil.essencia_tema || "Nenhum tema favorito informado."}</p>
                                </section>

                                <section>
                                    <strong>Minha frase</strong>
                                    <p>{perfil.essencia_frase || "Nenhuma frase adicionada ainda."}</p>
                                </section>

                                <section>
                                    <strong>Aberto para</strong>
                                    <p>{perfil.aberto_para || "Ainda não informado."}</p>
                                </section>
                            </div>
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

                        <h2>Mensagem</h2>
                        <p>Conversa com {perfil.nome}</p>

                        <div className="perfil-chat-list">
                            {mensagensChat.length === 0 ? (
                                <div className="perfil-chat-empty">
                                    Nenhuma mensagem ainda. Comece a conversa.
                                </div>
                            ) : (
                                mensagensChat.map((mensagem) => {
                                    const minhaMensagem =
                                        Number(mensagem.remetente_id) === Number(usuarioLogado?.id);

                                    return (
                                        <div
                                            className={
                                                minhaMensagem
                                                    ? "perfil-chat-message mine"
                                                    : "perfil-chat-message"
                                            }
                                            key={mensagem.id}
                                        >
                                            <p>{mensagem.mensagem}</p>
                                            <span>
                                                {mensagem.criado_em
                                                    ? new Date(mensagem.criado_em).toLocaleTimeString("pt-BR", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })
                                                    : "Agora"}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="perfil-chat-form">
                            <input
                                value={mensagemTexto}
                                onChange={(e) => setMensagemTexto(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        enviarMensagem();
                                    }
                                }}
                                placeholder="Digite sua mensagem..."
                            />

                            <button onClick={enviarMensagem} disabled={enviandoMensagem}>
                                <FiSend aria-hidden="true" />
                                {enviandoMensagem ? "..." : "Enviar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {postAberto && (
                <div className="perfil-post-modal-overlay" role="dialog" aria-modal="true">
                    <article className="perfil-post-modal">
                        <button
                            className="perfil-message-close"
                            onClick={() => setPostAberto(null)}
                            aria-label="Fechar"
                        >
                            <FiX aria-hidden="true" />
                        </button>

                        <h2>Publicação de {perfil.nome}</h2>

                        {renderPostMedia(postAberto, "perfil-post-modal-media")}

                        {postAberto.tema && <span className="perfil-post-modal-theme">#{postAberto.tema}</span>}
                        <p className="perfil-post-modal-text">{postAberto.conteudo}</p>

                        <div className="perfil-post-actions-pro modal-actions-inline">
                            <button
                                className={postAberto.curtiu ? "liked" : ""}
                                onClick={() => {
                                    curtirPost(postAberto.id);
                                    setPostAberto((prev) =>
                                        prev
                                            ? {
                                                ...prev,
                                                curtiu: !prev.curtiu,
                                                total_curtidas: prev.curtiu
                                                    ? Math.max(Number(prev.total_curtidas || 0) - 1, 0)
                                                    : Number(prev.total_curtidas || 0) + 1,
                                            }
                                            : prev,
                                    );
                                }}
                            >
                                <FiHeart aria-hidden="true" /> {postAberto.total_curtidas || 0}
                            </button>

                            <button onClick={() => abrirComentarios(postAberto.id)}>
                                <FiMessageCircle aria-hidden="true" /> {postAberto.total_comentarios || 0}
                            </button>

                            <button onClick={() => compartilhar(postAberto)}>
                                <FiShare2 aria-hidden="true" /> Compartilhar
                            </button>

                            <button className="report" onClick={() => denunciarPost(postAberto)}>
                                <FiAlertTriangle aria-hidden="true" /> Denunciar
                            </button>
                        </div>

                        <div className="perfil-comments-pro">
                            {(comentariosPost[postAberto.id] || []).length === 0 ? (
                                <p className="no-comments">Nenhum comentário ainda.</p>
                            ) : (
                                (comentariosPost[postAberto.id] || []).map((comentario) => (
                                    renderComentario(comentario, postAberto.id, false)
                                ))
                            )}

                            <div className="comment-form">
                                <input
                                    type="text"
                                    placeholder="Escreva um comentário..."
                                    value={novoComentario[postAberto.id] || ""}
                                    onChange={(e) =>
                                        setNovoComentario({
                                            ...novoComentario,
                                            [postAberto.id]: e.target.value,
                                        })
                                    }
                                />
                                <button onClick={() => comentar(postAberto.id)}>
                                    <FiSend aria-hidden="true" /> Enviar
                                </button>
                            </div>
                        </div>
                    </article>
                </div>
            )}
        </main>
    );
}
