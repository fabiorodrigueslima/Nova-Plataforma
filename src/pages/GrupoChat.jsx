import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/style.css";

export default function GrupoChat() {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem("token");
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    const [grupo, setGrupo] = useState(null);
    const [mensagens, setMensagens] = useState([]);
    const [mensagem, setMensagem] = useState("");
    const [loading, setLoading] = useState(true);

    const fimChatRef = useRef(null);

    async function carregarGrupo() {
        try {
            const res = await fetch(`http://localhost:5000/api/grupos/${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.erro || "Erro ao acessar grupo.");
                navigate("/sala-virtual");
                return;
            }

            setGrupo(data);
        } catch (error) {
            console.error("Erro ao carregar grupo:", error);
        }
    }

    async function carregarMensagens() {
        try {
            const res = await fetch(
                `http://localhost:5000/api/grupos/${id}/mensagens`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await res.json();
            setMensagens(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao carregar mensagens:", error);
        } finally {
            setLoading(false);
        }
    }

    async function enviarMensagem(e) {
        e.preventDefault();

        if (!mensagem.trim()) return;

        try {
            const res = await fetch(
                `http://localhost:5000/api/grupos/${id}/mensagens`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ mensagem }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                alert(data.erro || "Erro ao enviar mensagem.");
                return;
            }

            setMensagem("");
            carregarMensagens();
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
        }
    }

    function copiarCodigo() {
        navigator.clipboard.writeText(grupo.codigo_convite);
        alert("Código copiado!");
    }

    useEffect(() => {
        carregarGrupo();
        carregarMensagens();

        const intervalo = setInterval(() => {
            carregarMensagens();
        }, 3000);

        return () => clearInterval(intervalo);
    }, [id]);

    useEffect(() => {
        fimChatRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [mensagens]);

    if (loading) {
        return <div className="chat-loading">Carregando conversa...</div>;
    }

    return (
        <main className="grupo-chat-page">
            <section className="grupo-chat-container">
                <header className="grupo-chat-header">
                    <div>
                        <button
                            className="chat-voltar"
                            onClick={() => navigate("/sala-virtual")}
                        >
                            ← Voltar
                        </button>

                        <h1>{grupo?.nome}</h1>
                        <p>{grupo?.descricao}</p>

                        <span className="chat-categoria">{grupo?.categoria}</span>
                    </div>

                    {grupo?.papel === "admin" && (
                        <div className="chat-convite">
                            <small>Código para convidar</small>
                            <strong>{grupo.codigo_convite}</strong>

                            <button onClick={copiarCodigo}>Copiar código</button>
                        </div>
                    )}
                </header>

                <div className="chat-area">
                    {mensagens.length === 0 ? (
                        <div className="chat-vazio">
                            <h2>Nenhuma mensagem ainda</h2>
                            <p>Comece a conversa com o grupo.</p>
                        </div>
                    ) : (
                        mensagens.map((msg) => {
                            const minha = Number(msg.usuario_id) === Number(usuario?.id);

                            return (
                                <div
                                    key={msg.id}
                                    className={`chat-msg ${minha ? "minha" : "outra"}`}
                                >
                                    <div className="chat-avatar">
                                        {msg.foto ? (
                                            <img src={msg.foto} alt={msg.nome} />
                                        ) : (
                                            <span>{msg.nome?.charAt(0)}</span>
                                        )}
                                    </div>

                                    <div className="chat-balao">
                                        <strong>{minha ? "Você" : msg.nome}</strong>
                                        <p>{msg.mensagem}</p>

                                        <small>
                                            {new Date(msg.criado_em).toLocaleString("pt-BR")}
                                        </small>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    <div ref={fimChatRef}></div>
                </div>

                <form className="chat-form" onSubmit={enviarMensagem}>
                    <input
                        type="text"
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        placeholder="Digite sua mensagem..."
                    />

                    <button type="submit">Enviar</button>
                </form>
            </section>
        </main>
    );
}