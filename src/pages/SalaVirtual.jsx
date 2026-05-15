import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/style.css";

export default function SalaVirtual() {
    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    const [aba, setAba] = useState("meus");
    const [meusGrupos, setMeusGrupos] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [codigo, setCodigo] = useState("");

    const [modalExcluir, setModalExcluir] = useState(false);
    const [grupoExcluir, setGrupoExcluir] = useState(null);

    const [modalSucesso, setModalSucesso] = useState(false);
    const [sucessoTitulo, setSucessoTitulo] = useState("");
    const [sucessoTexto, setSucessoTexto] = useState("");
    const [sucessoCodigo, setSucessoCodigo] = useState("");
    const [grupoEntrarId, setGrupoEntrarId] = useState(null);

    const [form, setForm] = useState({
        nome: "",
        descricao: "",
        categoria: "",
    });

    async function carregarMeusGrupos() {
        try {
            const res = await fetch("http://localhost:5000/api/meus-grupos", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();
            setMeusGrupos(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao carregar meus grupos:", error);
        }
    }

    async function carregarGrupos() {
        try {
            const res = await fetch("http://localhost:5000/api/grupos", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();
            setGrupos(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao carregar grupos:", error);
        }
    }

    useEffect(() => {
        carregarMeusGrupos();
        carregarGrupos();
    }, []);

    function handleChange(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    }

    function abrirModalExcluir(grupo) {
        setGrupoExcluir(grupo);
        setModalExcluir(true);
    }

    function fecharModalExcluir() {
        setGrupoExcluir(null);
        setModalExcluir(false);
    }

    function abrirModalSucesso(titulo, texto, codigo = "", grupoId = null) {
        setSucessoTitulo(titulo);
        setSucessoTexto(texto);
        setSucessoCodigo(codigo);
        setGrupoEntrarId(grupoId);
        setModalSucesso(true);
    }

    function fecharModalSucesso() {
        setModalSucesso(false);
        setSucessoTitulo("");
        setSucessoTexto("");
        setSucessoCodigo("");

        if (grupoEntrarId) {
            navigate(`/grupo/${grupoEntrarId}`);
            setGrupoEntrarId(null);
        }
    }

    function copiarCodigo(codigoCopiar) {
        navigator.clipboard.writeText(codigoCopiar);
        abrirModalSucesso(
            "Código copiado!",
            "Agora você pode enviar esse código para os usuários convidados."
        );
    }

    async function criarGrupo(e) {
        e.preventDefault();

        try {
            const res = await fetch("http://localhost:5000/api/grupos", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!res.ok) {
                abrirModalSucesso(
                    "Não foi possível criar o grupo",
                    data.erro || "Verifique as informações e tente novamente."
                );
                return;
            }

            setForm({
                nome: "",
                descricao: "",
                categoria: "",
            });

            setAba("meus");
            carregarMeusGrupos();
            carregarGrupos();

            abrirModalSucesso(
                "Grupo criado com sucesso!",
                "Seu grupo foi criado. Compartilhe o código abaixo apenas com as pessoas que você deseja convidar.",
                data.grupo.codigo_convite
            );
        } catch (error) {
            console.error("Erro ao criar grupo:", error);

            abrirModalSucesso(
                "Erro ao criar grupo",
                "Aconteceu um problema ao criar o grupo. Tente novamente."
            );
        }
    }

    async function entrarComCodigo(e) {
        e.preventDefault();

        try {
            const res = await fetch("http://localhost:5000/api/grupos/entrar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ codigo }),
            });

            const data = await res.json();

            if (!res.ok) {
                abrirModalSucesso(
                    "Código inválido",
                    data.erro || "Confira o código enviado pelo administrador."
                );
                return;
            }

            setCodigo("");
            carregarMeusGrupos();

            abrirModalSucesso(
                "Entrada liberada!",
                "Você entrou no grupo com sucesso. Agora pode participar da conversa.",
                "",
                data.grupo?.id
            );
        } catch (error) {
            console.error("Erro ao entrar no grupo:", error);

            abrirModalSucesso(
                "Erro ao entrar no grupo",
                "Aconteceu um problema ao tentar entrar no grupo."
            );
        }
    }

    async function excluirGrupo() {
        if (!grupoExcluir) return;

        try {
            const res = await fetch(`http://localhost:5000/api/grupos/${grupoExcluir.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();

            if (!res.ok) {
                abrirModalSucesso(
                    "Não foi possível excluir",
                    data.erro || "Apenas o administrador pode excluir este grupo."
                );
                return;
            }

            fecharModalExcluir();

            carregarMeusGrupos();
            carregarGrupos();

            abrirModalSucesso(
                "Grupo excluído com sucesso!",
                "O grupo, os membros e todas as mensagens foram removidos permanentemente."
            );
        } catch (error) {
            console.error("Erro ao excluir grupo:", error);

            abrirModalSucesso(
                "Erro ao excluir grupo",
                "Aconteceu um problema ao excluir o grupo. Tente novamente."
            );
        }
    }

    return (
        <main className="sala-page">
            <section className="sala-hero">
                <button className="sala-voltar" onClick={() => navigate("/feed")}>
                    ← Voltar
                </button>

                <h1>Sala Virtual</h1>

                <p>Crie grupos, converse e se conecte com a comunidade em tempo real.</p>

                <p>
                    A Sala Virtual é um espaço para estudos, debates, amizades,
                    troca de ideias e conversas em grupo.
                </p>

                <div className="sala-reservada-info">
                    <h2>Venha para a Sala Reservada!</h2>

                    <p>
                        Convide as pessoas para ver suas postagens, debater,
                        opinar e estudar.
                    </p>

                    <p>
                        Se você quer continuar a discussão e debater os temas
                        com os usuários que te impressionaram, convide-os para
                        a Sala Reservada — um ambiente discreto e projetado para
                        quem deseja interagir com pessoas selecionadas em um
                        espaço reservado para convidados.
                    </p>

                    <p>
                        Construa amizades! Respeite as diferenças! Faça amigos
                        e não inimigos!
                    </p>
                </div>
            </section>

            <section className="sala-container">
                <div className="sala-tabs">
                    <button className={aba === "meus" ? "active" : ""} onClick={() => setAba("meus")}>
                        Meus Grupos
                    </button>

                    <button className={aba === "explorar" ? "active" : ""} onClick={() => setAba("explorar")}>
                        Explorar Grupos
                    </button>

                    <button className={aba === "criar" ? "active" : ""} onClick={() => setAba("criar")}>
                        Criar Grupo
                    </button>

                    <button className={aba === "entrar" ? "active" : ""} onClick={() => setAba("entrar")}>
                        Entrar com Código
                    </button>

                    <button className={aba === "reservada" ? "active" : ""} onClick={() => setAba("reservada")}>
                        Sala Reservada
                    </button>
                </div>

                {aba === "meus" && (
                    <div className="sala-box">
                        <div className="sala-box-top">
                            <h2>Meus Grupos</h2>

                            <button className="novo-grupo-btn" onClick={() => setAba("criar")}>
                                + Criar Grupo
                            </button>
                        </div>

                        {meusGrupos.length === 0 ? (
                            <p className="sala-vazio">
                                Você ainda não participa de nenhum grupo.
                            </p>
                        ) : (
                            <div className="sala-grid">
                                {meusGrupos.map((grupo) => (
                                    <article className="grupo-card" key={grupo.id}>
                                        <div className="grupo-top">
                                            <h3>{grupo.nome}</h3>
                                            <span>{grupo.categoria || "Geral"}</span>
                                        </div>

                                        <p>{grupo.descricao}</p>

                                        <small>👥 {grupo.total_membros || 1} membros</small>
                                        <small>👑 {grupo.papel}</small>

                                        {grupo.papel === "admin" && (
                                            <div className="grupo-codigo">
                                                Código: <strong>{grupo.codigo_convite}</strong>

                                                <button
                                                    type="button"
                                                    className="btn-copiar-codigo"
                                                    onClick={() => copiarCodigo(grupo.codigo_convite)}
                                                >
                                                    Copiar
                                                </button>
                                            </div>
                                        )}

                                        <div className="grupo-actions">
                                            <button onClick={() => navigate(`/grupo/${grupo.id}`)}>
                                                Acessar
                                            </button>

                                            {grupo.papel === "admin" && (
                                                <button
                                                    className="btn-excluir-grupo"
                                                    onClick={() => abrirModalExcluir(grupo)}
                                                >
                                                    Excluir
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {aba === "explorar" && (
                    <div className="sala-box">
                        <h2>Explorar Grupos</h2>

                        {grupos.length === 0 ? (
                            <p className="sala-vazio">Nenhum grupo criado ainda.</p>
                        ) : (
                            <div className="sala-grid">
                                {grupos.map((grupo) => (
                                    <article className="grupo-card" key={grupo.id}>
                                        <div className="grupo-top">
                                            <h3>{grupo.nome}</h3>
                                            <span>{grupo.categoria || "Geral"}</span>
                                        </div>

                                        <p>{grupo.descricao}</p>

                                        <small>Criado por {grupo.dono_nome}</small>
                                        <small>👥 {grupo.total_membros || 0} membros</small>

                                        <p className="grupo-aviso">
                                            🔒 Para entrar, peça o código ao administrador.
                                        </p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {aba === "criar" && (
                    <div className="sala-box">
                        <h2>Criar Grupo</h2>

                        <form className="sala-form" onSubmit={criarGrupo}>
                            <label>
                                Nome do grupo
                                <input
                                    type="text"
                                    name="nome"
                                    value={form.nome}
                                    onChange={handleChange}
                                    placeholder="Ex: Estudo de matemática"
                                    required
                                />
                            </label>

                            <label>
                                Categoria
                                <input
                                    type="text"
                                    name="categoria"
                                    value={form.categoria}
                                    onChange={handleChange}
                                    placeholder="Ex: Estudos, amizade, debate..."
                                />
                            </label>

                            <label>
                                Descrição
                                <textarea
                                    name="descricao"
                                    value={form.descricao}
                                    onChange={handleChange}
                                    placeholder="Explique o objetivo do grupo..."
                                    required
                                />
                            </label>

                            <button type="submit">Criar Grupo</button>
                        </form>
                    </div>
                )}

                {aba === "entrar" && (
                    <div className="sala-box">
                        <h2>Entrar com Código</h2>

                        <form className="sala-form" onSubmit={entrarComCodigo}>
                            <label>
                                Código do grupo
                                <input
                                    type="text"
                                    value={codigo}
                                    onChange={(e) => setCodigo(e.target.value)}
                                    placeholder="Digite o código enviado pelo administrador"
                                    required
                                />
                            </label>

                            <button type="submit">Entrar no Grupo</button>
                        </form>
                    </div>
                )}

                {aba === "reservada" && (
                    <div className="sala-box">
                        <h2>Sala Reservada</h2>

                        <p className="sala-reservada-texto">
                            A Sala Reservada é um espaço privado. Somente pessoas
                            autorizadas podem entrar.
                        </p>

                        <p className="sala-reservada-texto">
                            O administrador cria o grupo e compartilha o código
                            apenas com quem deseja convidar.
                        </p>

                        <p className="sala-reservada-texto">
                            Esse ambiente é ideal para estudos, debates reservados,
                            amizades, troca de ideias e conversas mais próximas.
                        </p>

                        <div className="sala-reservada-actions">
                            <button className="sala-reservada-btn" onClick={() => setAba("criar")}>
                                Criar Sala Reservada
                            </button>

                            <button className="sala-reservada-btn secundario" onClick={() => setAba("entrar")}>
                                Entrar com Código
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {modalExcluir && (
                <div className="modal-overlay">
                    <div className="modal-excluir">
                        <div className="modal-icon">⚠️</div>

                        <h2>Excluir grupo</h2>

                        <p>
                            Tem certeza que deseja excluir o grupo
                            <strong> {grupoExcluir?.nome}</strong>?
                        </p>

                        <span>
                            Todas as mensagens, membros e conversas serão removidas permanentemente.
                        </span>

                        <div className="modal-actions">
                            <button className="modal-cancelar" onClick={fecharModalExcluir}>
                                Cancelar
                            </button>

                            <button className="modal-excluir-btn" onClick={excluirGrupo}>
                                Excluir grupo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalSucesso && (
                <div className="modal-overlay">
                    <div className="modal-sucesso">
                        <div className="modal-sucesso-icon">✅</div>

                        <h2>{sucessoTitulo}</h2>

                        <p>{sucessoTexto}</p>

                        {sucessoCodigo && (
                            <div className="modal-codigo-box">
                                <span>Código do grupo</span>

                                <strong>{sucessoCodigo}</strong>

                                <button
                                    type="button"
                                    onClick={() => copiarCodigo(sucessoCodigo)}
                                >
                                    Copiar código
                                </button>
                            </div>
                        )}

                        <button className="modal-ok-btn" onClick={fecharModalSucesso}>
                            Entendi
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}