import { useEffect, useState } from "react";
import {
    FiEdit2,
    FiFileText,
    FiFilm,
    FiGlobe,
    FiHeart,
    FiImage,
    FiMessageCircle,
    FiSend,
    FiShare2,
    FiTrash2,
    FiXCircle,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { analisarConteudo } from "../utils/moderacao";
import "../styles/style.css";

function Avatar({ className = "post-avatar", foto, nome, onClick }) {
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
        </button>
    );
}

export default function FeedCenter({ temaAtivo = "Todos", posts = [], setPosts }) {
    const navigate = useNavigate();
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");

    const [texto, setTexto] = useState("");
    const [tema, setTema] = useState("Geral");
    const [sentimento, setSentimento] = useState("");
    const [arquivo, setArquivo] = useState(null);
    const [preview, setPreview] = useState(null);
    const [tipoArquivo, setTipoArquivo] = useState("");
    const [comentarioAberto, setComentarioAberto] = useState(null);
    const [novoComentario, setNovoComentario] = useState({});
    const [comentariosPost, setComentariosPost] = useState({});
    const [editandoId, setEditandoId] = useState(null);
    const [textoEditado, setTextoEditado] = useState("");
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [publicando, setPublicando] = useState(false);
    const [avisoModeracao, setAvisoModeracao] = useState("");

    async function carregarPosts() {
        try {
            setLoadingPosts(true);
            const res = await api.get("/posts");
            setPosts(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Erro ao carregar posts:", error);
        } finally {
            setLoadingPosts(false);
        }
    }

    useEffect(() => {
        carregarPosts();
    }, []);

    function selecionarArquivo(e) {
        const file = e.target.files[0];
        if (!file) return;

        setArquivo(file);
        setPreview(URL.createObjectURL(file));

        if (file.type.startsWith("image")) setTipoArquivo("imagem");
        else if (file.type.startsWith("video")) setTipoArquivo("video");
        else setTipoArquivo("documento");
    }

    function removerArquivo() {
        setArquivo(null);
        setPreview(null);
        setTipoArquivo("");
    }

    function validarTexto(textoValidar, usarAviso = false) {
        const moderacao = analisarConteudo(textoValidar);

        if (moderacao.aprovado) return true;

        if (usarAviso) setAvisoModeracao(moderacao.motivo);
        else alert(moderacao.motivo);

        return false;
    }

    async function publicar() {
        if (!texto.trim() && !arquivo) {
            alert("Escreva algo ou escolha uma foto, vídeo ou documento.");
            return;
        }

        if (!validarTexto(texto, true)) return;

        try {
            setPublicando(true);
            setAvisoModeracao("");

            const formData = new FormData();
            formData.append("conteudo", texto.trim());
            formData.append("tema", tema);
            formData.append("sentimento", sentimento);

            if (arquivo) formData.append("imagem", arquivo);

            const res = await api.post("/posts", formData);
            const novoPost = res.data.post || res.data;

            setPosts((prev) => [novoPost, ...prev]);
            setTexto("");
            setTema("Geral");
            setSentimento("");
            removerArquivo();
        } catch (error) {
            console.error("Erro ao publicar:", error);
            alert(error.response?.data?.erro || "Erro ao publicar post.");
        } finally {
            setPublicando(false);
        }
    }

    async function curtirPost(id) {
        try {
            const res = await api.post("/curtir", { post_id: id });
            const data = res.data;

            setPosts((prev) =>
                prev.map((post) => {
                    if (post.id !== id) return post;

                    const totalAtual = Number(post.total_curtidas || 0);

                    return {
                        ...post,
                        curtiu: data.curtiu,
                        total_curtidas: data.curtiu ? totalAtual + 1 : Math.max(totalAtual - 1, 0),
                    };
                }),
            );
        } catch (error) {
            console.error("Erro ao curtir post:", error);
            alert(error.response?.data?.erro || "Erro ao curtir post.");
        }
    }

    async function excluirPost(id) {
        if (!window.confirm("Deseja excluir este post?")) return;

        try {
            await api.delete(`/posts/${id}`);
            setPosts((prev) => prev.filter((post) => post.id !== id));
        } catch (error) {
            console.error("Erro ao excluir post:", error);
            alert(error.response?.data?.erro || "Erro ao excluir post.");
        }
    }

    function iniciarEdicao(post) {
        setEditandoId(post.id);
        setTextoEditado(post.conteudo || post.texto || "");
    }

    async function salvarEdicao(id) {
        if (!textoEditado.trim()) {
            alert("O texto não pode ficar vazio.");
            return;
        }

        if (!validarTexto(textoEditado)) return;

        try {
            const res = await api.put(`/posts/${id}`, { conteudo: textoEditado.trim() });
            const postAtualizado = res.data.post || res.data;

            setPosts((prev) =>
                prev.map((post) =>
                    post.id === id
                        ? { ...post, ...postAtualizado, conteudo: postAtualizado.conteudo || textoEditado.trim() }
                        : post,
                ),
            );

            setEditandoId(null);
            setTextoEditado("");
        } catch (error) {
            console.error("Erro ao editar post:", error);
            alert(error.response?.data?.erro || "Erro ao editar post.");
        }
    }

    async function abrirComentarios(id) {
        if (comentarioAberto === id) {
            setComentarioAberto(null);
            return;
        }

        setComentarioAberto(id);

        try {
            const res = await api.get(`/comentarios?post_id=${id}`);
            setComentariosPost((prev) => ({ ...prev, [id]: Array.isArray(res.data) ? res.data : [] }));
        } catch (error) {
            console.error("Erro ao carregar comentários:", error);
        }
    }

    async function comentar(id) {
        const textoComentario = novoComentario[id];
        if (!textoComentario?.trim()) return;
        if (!validarTexto(textoComentario)) return;

        try {
            const res = await api.post("/comentarios", {
                post_id: id,
                conteudo: textoComentario.trim(),
            });
            const comentario = res.data.comentario || res.data;

            setComentariosPost((prev) => ({
                ...prev,
                [id]: [...(prev[id] || []), comentario],
            }));

            setPosts((prev) =>
                prev.map((post) =>
                    post.id === id
                        ? { ...post, total_comentarios: Number(post.total_comentarios || 0) + 1 }
                        : post,
                ),
            );

            setNovoComentario((prev) => ({ ...prev, [id]: "" }));
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
        const autor = post.autor || post.nome || "Usuário";
        const textoCompartilhar = `${autor} postou no PostFan:\n\n${textoPost}`;

        if (navigator.share) {
            navigator.share({ title: "PostFan", text: textoCompartilhar });
        } else {
            navigator.clipboard.writeText(textoCompartilhar);
            alert("Texto do post copiado para compartilhar.");
        }
    }

    const postsFiltrados = temaAtivo === "Todos" ? posts : posts.filter((post) => post.tema === temaAtivo);

    return (
        <section className="feed-center">
            <div className="post-box">
                <div className="post-user">
                    <Avatar foto={usuario?.foto} nome={usuario?.nome} />

                    <textarea
                        placeholder="No que você está pensando?"
                        value={texto}
                        onChange={(e) => {
                            setTexto(e.target.value);
                            if (avisoModeracao) setAvisoModeracao("");
                        }}
                    />
                </div>

                <div className="safety-note">
                    <strong>Convivência segura</strong>
                    <span>Racismo, injúria, ameaças e ataques discriminatórios são bloqueados.</span>
                </div>

                {avisoModeracao && (
                    <div className="moderation-alert" role="alert">
                        <FiXCircle aria-hidden="true" />
                        <span>{avisoModeracao}</span>
                    </div>
                )}

                {preview && (
                    <div className="preview-box">
                        {tipoArquivo === "imagem" && <img src={preview} alt="Preview" />}
                        {tipoArquivo === "video" && <video src={preview} controls />}
                        {tipoArquivo === "documento" && (
                            <div className="document-preview">
                                <FiFileText aria-hidden="true" /> <span>{arquivo?.name}</span>
                            </div>
                        )}

                        <button className="remove-preview" onClick={removerArquivo}>
                            Remover
                        </button>
                    </div>
                )}

                <div className="post-actions">
                    <label className="file-btn">
                        <FiImage aria-hidden="true" /> Foto
                        <input type="file" accept="image/*" onChange={selecionarArquivo} hidden />
                    </label>

                    <label className="file-btn">
                        <FiFilm aria-hidden="true" /> Vídeo
                        <input type="file" accept="video/*" onChange={selecionarArquivo} hidden />
                    </label>

                    <label className="file-btn">
                        <FiFileText aria-hidden="true" /> Documento
                        <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={selecionarArquivo} hidden />
                    </label>

                    <select value={sentimento} onChange={(e) => setSentimento(e.target.value)}>
                        <option value="">Como está se sentindo?</option>
                        <option value="Feliz">Feliz</option>
                        <option value="Triste">Triste</option>
                        <option value="Animado">Animado</option>
                        <option value="Pensativo">Pensativo</option>
                        <option value="Grato">Grato</option>
                    </select>

                    <select value={tema} onChange={(e) => setTema(e.target.value)}>
                        <option>Geral</option>
                        <option>Política</option>
                        <option>Religião</option>
                        <option>Esporte</option>
                        <option>Saúde</option>
                        <option>Ciência</option>
                        <option>Entretenimento</option>
                        <option>Relacionamento</option>
                        <option>Sobrenatural</option>
                        <option>Tecnologia</option>
                        <option>Educação</option>
                        <option>Trabalho</option>
                        <option>Família</option>
                        <option>Cultura</option>
                        <option>Meio Ambiente</option>
                        <option>Notícias</option>
                    </select>

                    <button className="publish-btn" onClick={publicar} disabled={publicando}>
                        {publicando ? "Publicando..." : "Publicar"}
                    </button>
                </div>
            </div>

            <div className="feed-tabs">
                <button className="active">
                    <FiGlobe aria-hidden="true" /> {temaAtivo}
                </button>
            </div>

            <div className="posts-list">
                {loadingPosts ? (
                    <div className="empty-feed">
                        <h3>Carregando posts...</h3>
                    </div>
                ) : postsFiltrados.length === 0 ? (
                    <div className="empty-feed">
                        <h3>Nenhum post ainda</h3>
                        <p>Faça sua primeira publicação no PostFan.</p>
                    </div>
                ) : (
                    postsFiltrados.map((post) => {
                        const textoPost = post.conteudo || post.texto || "";
                        const autor = post.autor || post.nome || post.usuario_nome || "Usuário";
                        const fotoAutor = post.fotoAutor || post.foto || post.usuario_foto || "";
                        const imagemPost = post.imagem || post.arquivoUrl || "";
                        const criadoEm = post.criado_em
                            ? new Date(post.criado_em).toLocaleString("pt-BR")
                            : post.criadoEm || "";
                        const donoPost = Number(post.usuario_id || post.usuarioId) === Number(usuario?.id);
                        const autorId = post.usuario_id || post.usuarioId || post.autor_id;
                        const comentarios = comentariosPost[post.id] || post.comentarios || [];

                        function abrirPerfilAutor() {
                            if (autorId) navigate(`/perfil/${autorId}`);
                        }

                        return (
                            <article className="feed-post" key={post.id}>
                                <div className="feed-post-top">
                                    <Avatar foto={fotoAutor} nome={autor} onClick={abrirPerfilAutor} />

                                    <div>
                                        <button type="button" className="post-author-link" onClick={abrirPerfilAutor}>
                                            {autor}
                                        </button>
                                        <span>{criadoEm}</span>
                                    </div>

                                    {donoPost && (
                                        <div className="post-menu">
                                            <button onClick={() => iniciarEdicao(post)} aria-label="Editar post">
                                                <FiEdit2 aria-hidden="true" />
                                            </button>
                                            <button onClick={() => excluirPost(post.id)} aria-label="Excluir post">
                                                <FiTrash2 aria-hidden="true" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {post.tema && <span className="post-theme">#{post.tema}</span>}
                                {post.sentimento && <span className="post-feeling">Está se sentindo {post.sentimento}</span>}

                                {editandoId === post.id ? (
                                    <div className="edit-box">
                                        <textarea value={textoEditado} onChange={(e) => setTextoEditado(e.target.value)} />
                                        <div>
                                            <button onClick={() => salvarEdicao(post.id)}>Salvar</button>
                                            <button onClick={() => setEditandoId(null)}>Cancelar</button>
                                        </div>
                                    </div>
                                ) : (
                                    textoPost && <p>{textoPost}</p>
                                )}

                                {imagemPost && (
                                    <img
                                        className="post-media"
                                        src={imagemPost}
                                        alt="Post"
                                        onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                        }}
                                    />
                                )}

                                <div className="feed-post-actions">
                                    <button className={post.curtiu ? "liked" : ""} onClick={() => curtirPost(post.id)}>
                                        <FiHeart aria-hidden="true" /> {post.total_curtidas || 0}
                                    </button>
                                    <button onClick={() => abrirComentarios(post.id)}>
                                        <FiMessageCircle aria-hidden="true" /> {post.total_comentarios || 0}
                                    </button>
                                    <button onClick={() => compartilhar(post)}>
                                        <FiShare2 aria-hidden="true" /> Compartilhar
                                    </button>
                                </div>

                                {comentarioAberto === post.id && (
                                    <div className="comments-box">
                                        {comentarios.length === 0 ? (
                                            <p className="no-comments">Nenhum comentário ainda.</p>
                                        ) : (
                                            comentarios.map((comentario) => (
                                                <div className="comment-item" key={comentario.id}>
                                                    <strong>{comentario.autor || comentario.nome || "Usuário"}</strong>
                                                    <p>{comentario.conteudo || comentario.texto}</p>
                                                    <span>
                                                        {comentario.criado_em
                                                            ? new Date(comentario.criado_em).toLocaleString("pt-BR")
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
                    })
                )}
            </div>
        </section>
    );
}
