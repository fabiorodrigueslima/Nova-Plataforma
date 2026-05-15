import { useEffect, useState } from "react";
import "../styles/style.css";

export default function FeedCenter({
    temaAtivo = "Todos",
    posts = [],
    setPosts,
}) {
    const usuario = JSON.parse(localStorage.getItem("usuario")) || {};

    const [texto, setTexto] = useState("");
    const [tema, setTema] = useState("Geral");
    const [sentimento, setSentimento] = useState("");
    const [arquivo, setArquivo] = useState(null);
    const [preview, setPreview] = useState(null);
    const [tipoArquivo, setTipoArquivo] = useState("");

    const [comentarioAberto, setComentarioAberto] = useState(null);
    const [novoComentario, setNovoComentario] = useState({});
    const [editandoId, setEditandoId] = useState(null);
    const [textoEditado, setTextoEditado] = useState("");

    useEffect(() => {
        localStorage.setItem("postsPostfan", JSON.stringify(posts));
    }, [posts]);

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

    function publicar() {
        if (!texto.trim() && !arquivo) {
            alert("Escreva algo ou escolha uma foto/vídeo/documento.");
            return;
        }

        const novoPost = {
            id: Date.now(),
            texto: texto.trim(),
            tema,
            sentimento,
            autor: usuario?.nome || usuario?.nome_completo || "Usuário",
            fotoAutor: usuario?.foto || "",
            arquivoNome: arquivo?.name || "",
            arquivoUrl: preview || "",
            tipoArquivo,
            likes: 0,
            curtiu: false,
            comentarios: [],
            criadoEm: new Date().toLocaleString("pt-BR"),
            usuarioId: usuario?.id || null,
        };

        setPosts([novoPost, ...posts]);

        setTexto("");
        setTema("Geral");
        setSentimento("");
        removerArquivo();
    }

    function curtirPost(id) {
        setPosts(
            posts.map((post) =>
                post.id === id
                    ? {
                        ...post,
                        curtiu: !post.curtiu,
                        likes: post.curtiu ? post.likes - 1 : post.likes + 1,
                    }
                    : post
            )
        );
    }

    function excluirPost(id) {
        if (!window.confirm("Deseja excluir este post?")) return;
        setPosts(posts.filter((post) => post.id !== id));
    }

    function iniciarEdicao(post) {
        setEditandoId(post.id);
        setTextoEditado(post.texto || "");
    }

    function salvarEdicao(id) {
        setPosts(
            posts.map((post) =>
                post.id === id ? { ...post, texto: textoEditado.trim() } : post
            )
        );

        setEditandoId(null);
        setTextoEditado("");
    }

    function comentar(id) {
        const textoComentario = novoComentario[id];

        if (!textoComentario?.trim()) return;

        const comentario = {
            id: Date.now(),
            autor: usuario?.nome || usuario?.nome_completo || "Usuário",
            texto: textoComentario.trim(),
            criadoEm: "Agora mesmo",
        };

        setPosts(
            posts.map((post) =>
                post.id === id
                    ? {
                        ...post,
                        comentarios: [...(post.comentarios || []), comentario],
                    }
                    : post
            )
        );

        setNovoComentario({ ...novoComentario, [id]: "" });
    }

    function compartilhar(post) {
        const textoCompartilhar = `${post.autor} postou no PostFan:\n\n${post.texto}`;

        if (navigator.share) {
            navigator.share({
                title: "PostFan",
                text: textoCompartilhar,
            });
        } else {
            navigator.clipboard.writeText(textoCompartilhar);
            alert("Texto do post copiado para compartilhar.");
        }
    }

    const postsFiltrados =
        temaAtivo === "Todos"
            ? posts
            : posts.filter((post) => post.tema === temaAtivo);

    return (
        <section className="feed-center">
            <div className="post-box">
                <div className="post-user">
                    <div className="post-avatar">
                        {usuario?.foto ? (
                            <img src={usuario.foto} alt={usuario.nome} />
                        ) : (
                            usuario?.nome?.charAt(0) || "?"
                        )}
                    </div>

                    <textarea
                        placeholder="No que você está pensando?"
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                    />
                </div>

                {preview && (
                    <div className="preview-box">
                        {tipoArquivo === "imagem" && <img src={preview} alt="Preview" />}

                        {tipoArquivo === "video" && <video src={preview} controls />}

                        {tipoArquivo === "documento" && (
                            <div className="document-preview">
                                📄 <span>{arquivo?.name}</span>
                            </div>
                        )}

                        <button className="remove-preview" onClick={removerArquivo}>
                            Remover
                        </button>
                    </div>
                )}

                <div className="post-actions">
                    <label className="file-btn">
                        📷 Foto
                        <input type="file" accept="image/*" onChange={selecionarArquivo} hidden />
                    </label>

                    <label className="file-btn">
                        🎥 Vídeo
                        <input type="file" accept="video/*" onChange={selecionarArquivo} hidden />
                    </label>

                    <label className="file-btn">
                        📄 Documento
                        <input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            onChange={selecionarArquivo}
                            hidden
                        />
                    </label>

                    <select value={sentimento} onChange={(e) => setSentimento(e.target.value)}>
                        <option value="">😊 Como está se sentindo?</option>
                        <option value="Feliz">😄 Feliz</option>
                        <option value="Triste">😢 Triste</option>
                        <option value="Animado">🔥 Animado</option>
                        <option value="Pensativo">🤔 Pensativo</option>
                        <option value="Grato">🙏 Grato</option>
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

                    <button className="publish-btn" onClick={publicar}>
                        Publicar
                    </button>
                </div>
            </div>

            <div className="feed-tabs">
                <button className="active">🌐 {temaAtivo}</button>
            </div>

            <div className="posts-list">
                {postsFiltrados.length === 0 ? (
                    <div className="empty-feed">
                        <h3>Nenhum post ainda</h3>
                        <p>Faça sua primeira publicação no PostFan.</p>
                    </div>
                ) : (
                    postsFiltrados.map((post) => (
                        <article className="feed-post" key={post.id}>
                            <div className="feed-post-top">
                                <div className="post-avatar">
                                    {post.fotoAutor ? (
                                        <img src={post.fotoAutor} alt={post.autor} />
                                    ) : (
                                        post.autor?.charAt(0) || "?"
                                    )}
                                </div>

                                <div>
                                    <h4>{post.autor}</h4>
                                    <span>{post.criadoEm}</span>
                                </div>

                                <div className="post-menu">
                                    <button onClick={() => iniciarEdicao(post)}>✏️</button>
                                    <button onClick={() => excluirPost(post.id)}>🗑️</button>
                                </div>
                            </div>

                            <span className="post-theme">#{post.tema}</span>

                            {post.sentimento && (
                                <span className="post-feeling">
                                    Está se sentindo {post.sentimento}
                                </span>
                            )}

                            {editandoId === post.id ? (
                                <div className="edit-box">
                                    <textarea
                                        value={textoEditado}
                                        onChange={(e) => setTextoEditado(e.target.value)}
                                    />

                                    <div>
                                        <button onClick={() => salvarEdicao(post.id)}>Salvar</button>
                                        <button onClick={() => setEditandoId(null)}>Cancelar</button>
                                    </div>
                                </div>
                            ) : (
                                post.texto && <p>{post.texto}</p>
                            )}

                            {post.arquivoUrl && post.tipoArquivo === "imagem" && (
                                <img className="post-media" src={post.arquivoUrl} alt="Post" />
                            )}

                            {post.arquivoUrl && post.tipoArquivo === "video" && (
                                <video className="post-media" src={post.arquivoUrl} controls />
                            )}

                            {post.arquivoUrl && post.tipoArquivo === "documento" && (
                                <a
                                    className="post-document"
                                    href={post.arquivoUrl}
                                    download={post.arquivoNome}
                                >
                                    📄 Baixar documento: {post.arquivoNome}
                                </a>
                            )}

                            <div className="feed-post-actions">
                                <button
                                    className={post.curtiu ? "liked" : ""}
                                    onClick={() => curtirPost(post.id)}
                                >
                                    ❤️ {post.likes}
                                </button>

                                <button
                                    onClick={() =>
                                        setComentarioAberto(
                                            comentarioAberto === post.id ? null : post.id
                                        )
                                    }
                                >
                                    💬 {(post.comentarios || []).length}
                                </button>

                                <button onClick={() => compartilhar(post)}>
                                    🔗 Compartilhar
                                </button>
                            </div>

                            {comentarioAberto === post.id && (
                                <div className="comments-box">
                                    {(post.comentarios || []).length === 0 ? (
                                        <p className="no-comments">Nenhum comentário ainda.</p>
                                    ) : (
                                        post.comentarios.map((comentario) => (
                                            <div className="comment-item" key={comentario.id}>
                                                <strong>{comentario.autor}</strong>
                                                <p>{comentario.texto}</p>
                                                <span>{comentario.criadoEm}</span>
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

                                        <button onClick={() => comentar(post.id)}>Enviar</button>
                                    </div>
                                </div>
                            )}
                        </article>
                    ))
                )}
            </div>
        </section>
    );
}