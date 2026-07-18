import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiMessageCircle, FiSend } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { analisarConteudo } from "../utils/moderacao";
import "../styles/style.css";

function obterUsuarioLogado() {
    try {
        return JSON.parse(localStorage.getItem("usuario") || "{}") || {};
    } catch {
        return {};
    }
}

export default function Mensagens() {
    const navigate = useNavigate();
    const fimRef = useRef(null);
    const usuario = obterUsuarioLogado();
    const [conversas, setConversas] = useState([]);
    const [contato, setContato] = useState(null);
    const [mensagens, setMensagens] = useState([]);
    const [texto, setTexto] = useState("");
    const [aviso, setAviso] = useState("");
    const [carregando, setCarregando] = useState(true);

    async function carregarConversas() {
        try {
            const resposta = await api.get("/conversas");
            setConversas(Array.isArray(resposta.data) ? resposta.data : []);
        } catch (error) {
            console.error("Erro ao carregar conversas:", error);
        } finally {
            setCarregando(false);
        }
    }

    async function abrirConversa(pessoa) {
        setContato(pessoa);
        setAviso("");

        try {
            const resposta = await api.get(`/mensagens/${pessoa.usuario_id}`);
            setMensagens(Array.isArray(resposta.data) ? resposta.data : []);
            await carregarConversas();
        } catch (error) {
            console.error("Erro ao abrir conversa:", error);
        }
    }

    async function enviarMensagem(event) {
        event.preventDefault();
        if (!contato || !texto.trim()) return;

        const moderacao = analisarConteudo(texto);
        if (!moderacao.aprovado) {
            setAviso(moderacao.motivo);
            return;
        }

        try {
            await api.post("/mensagens", {
                destinatario_id: contato.usuario_id,
                mensagem: texto.trim(),
            });
            setTexto("");
            setAviso("");
            await abrirConversa(contato);
        } catch (error) {
            setAviso(error.response?.data?.erro || "Não foi possível enviar a mensagem.");
        }
    }

    useEffect(() => {
        carregarConversas();
    }, []);

    useEffect(() => {
        if (!contato) return undefined;
        const intervalo = setInterval(() => abrirConversa(contato), 5000);
        return () => clearInterval(intervalo);
    }, [contato?.usuario_id]);

    useEffect(() => {
        fimRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [mensagens]);

    return (
        <main className="direct-page">
            <section className={`direct-layout ${contato ? "conversation-open" : ""}`}>
                <aside className="direct-inbox">
                    <header>
                        <button type="button" onClick={() => navigate("/feed")} aria-label="Voltar ao feed">
                            <FiArrowLeft />
                        </button>
                        <div>
                            <span>PostFan</span>
                            <h1>Mensagens</h1>
                        </div>
                    </header>

                    {carregando ? (
                        <div className="direct-empty">
                            <FiMessageCircle />
                            <h2>Carregando conversas...</h2>
                        </div>
                    ) : conversas.length === 0 ? (
                        <div className="direct-empty">
                            <FiMessageCircle />
                            <h2>Nenhuma conversa</h2>
                            <p>Abra o perfil de outro usuário para enviar a primeira mensagem.</p>
                        </div>
                    ) : (
                        <div className="direct-contacts">
                            {conversas.map((pessoa) => (
                                <button
                                    type="button"
                                    key={pessoa.usuario_id}
                                    className={contato?.usuario_id === pessoa.usuario_id ? "active" : ""}
                                    onClick={() => abrirConversa(pessoa)}
                                >
                                    <span className="direct-avatar">
                                        {pessoa.foto ? <img src={pessoa.foto} alt="" /> : pessoa.nome?.charAt(0)}
                                    </span>
                                    <span className="direct-contact-copy">
                                        <strong>{pessoa.nome}</strong>
                                        <small>{pessoa.ultima_mensagem}</small>
                                    </span>
                                    {Number(pessoa.nao_lidas) > 0 && (
                                        <span className="direct-unread">{pessoa.nao_lidas}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </aside>

                <section className="direct-chat">
                    {!contato ? (
                        <div className="direct-placeholder">
                            <FiMessageCircle />
                            <h2>Suas conversas</h2>
                            <p>Selecione uma pessoa para continuar a conversa.</p>
                        </div>
                    ) : (
                        <>
                            <header>
                                <button className="direct-mobile-back" type="button" onClick={() => setContato(null)}>
                                    <FiArrowLeft />
                                </button>
                                <span className="direct-avatar">
                                    {contato.foto ? <img src={contato.foto} alt="" /> : contato.nome?.charAt(0)}
                                </span>
                                <div>
                                    <strong>{contato.nome}</strong>
                                    <small>Conversa privada</small>
                                </div>
                            </header>

                            <div className="direct-messages">
                                {mensagens.map((mensagem) => {
                                    const minha = Number(mensagem.remetente_id) === Number(usuario.id);
                                    return (
                                        <div className={`direct-bubble ${minha ? "mine" : ""}`} key={mensagem.id}>
                                            <p>{mensagem.mensagem}</p>
                                            <small>
                                                {new Date(mensagem.criado_em).toLocaleTimeString("pt-BR", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </small>
                                        </div>
                                    );
                                })}
                                <div ref={fimRef} />
                            </div>

                            <form className="direct-form" onSubmit={enviarMensagem}>
                                {aviso && <p>{aviso}</p>}
                                <div>
                                    <input
                                        value={texto}
                                        onChange={(event) => setTexto(event.target.value)}
                                        placeholder="Escreva uma mensagem..."
                                        aria-label="Mensagem"
                                    />
                                    <button type="submit" aria-label="Enviar mensagem">
                                        <FiSend />
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </section>
            </section>
        </main>
    );
}
